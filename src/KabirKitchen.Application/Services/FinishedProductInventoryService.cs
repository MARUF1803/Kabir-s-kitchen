using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Inventory;
using KabirKitchen.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Application.Services;

public class FinishedProductInventoryService
{
    private readonly IApplicationDbContext _context;
    private readonly LotManagementService _lotService;

    public FinishedProductInventoryService(
        IApplicationDbContext context,
        LotManagementService lotService)
    {
        _context = context;
        _lotService = lotService;
    }

    public async Task<List<BranchProductStockDto>> GetBranchProductStocksAsync(long branchId, CancellationToken ct = default)
    {
        var stocks = await _context.BranchProductStocks
            .Include(s => s.Branch)
            .Include(s => s.MenuItem)
            .Where(s => s.BranchId == branchId && s.MenuItem != null && !s.MenuItem.IsDeleted)
            .ToListAsync(ct);

        return stocks.Select(s => new BranchProductStockDto(
            s.Id,
            s.BranchId,
            s.Branch?.Name ?? "",
            s.MenuItemId,
            s.MenuItem?.Name ?? "",
            s.MenuItemVariantId,
            null, // variant name can be mapped if variant loaded
            s.CurrentStockQuantity,
            s.ReservedQuantity,
            s.QuarantinedQuantity,
            s.AvailableQuantity,
            s.MinimumAlertStock,
            s.MovingAverageCostPerUnit
        )).ToList();
    }

    public async Task<Result<ProductStockTransaction>> RecordProductStockTransactionAsync(
        long branchId,
        long menuItemId,
        long? menuItemVariantId,
        ProductStockTransactionType transactionType,
        decimal quantityChange,
        decimal unitCost,
        string? referenceDocType,
        string? referenceDocNumber,
        string? remarks,
        long? productionBatchId,
        long? orderId,
        long? performedByUserId,
        bool allocateFefo = false,
        CancellationToken ct = default)
    {
        var menuItem = await _context.MenuItems.FindAsync(new object[] { menuItemId }, ct);
        if (menuItem == null)
            return Result<ProductStockTransaction>.Failure("Menu item not found.");

        var stock = await _context.BranchProductStocks
            .FirstOrDefaultAsync(s => s.BranchId == branchId &&
                                      s.MenuItemId == menuItemId &&
                                      s.MenuItemVariantId == menuItemVariantId, ct);

        if (stock == null)
        {
            stock = new BranchProductStock
            {
                BranchId = branchId,
                MenuItemId = menuItemId,
                MenuItemVariantId = menuItemVariantId,
                CurrentStockQuantity = 0,
                ReservedQuantity = 0,
                QuarantinedQuantity = 0,
                MovingAverageCostPerUnit = unitCost
            };
            _context.BranchProductStocks.Add(stock);
        }

        decimal quantityBefore = stock.CurrentStockQuantity;
        stock.CurrentStockQuantity += quantityChange;
        decimal quantityAfter = stock.CurrentStockQuantity;

        if (transactionType == ProductStockTransactionType.ProductionAccepted && unitCost > 0 && quantityChange > 0)
        {
            var existingQty = quantityBefore;
            var oldAvg = stock.MovingAverageCostPerUnit > 0 ? stock.MovingAverageCostPerUnit : unitCost;
            var newAvg = existingQty > 0
                ? ((existingQty * oldAvg) + (quantityChange * unitCost)) / (existingQty + quantityChange)
                : unitCost;
            stock.MovingAverageCostPerUnit = newAvg;
        }

        stock.UpdatedAtUtc = DateTime.UtcNow;

        var txn = new ProductStockTransaction
        {
            BranchId = branchId,
            MenuItemId = menuItemId,
            MenuItemVariantId = menuItemVariantId,
            BranchProductStockId = stock.Id,
            TransactionType = transactionType,
            QuantityChange = quantityChange,
            QuantityBefore = quantityBefore,
            QuantityAfter = quantityAfter,
            UnitUsed = UnitType.Piece,
            UnitCostAtTransaction = unitCost,
            TotalCost = Math.Abs(quantityChange * unitCost),
            ProductionBatchId = productionBatchId,
            OrderId = orderId,
            ReferenceDocumentType = referenceDocType,
            ReferenceDocumentNumber = referenceDocNumber,
            Remarks = remarks,
            PerformedByUserId = performedByUserId,
            TransactionDateUtc = DateTime.UtcNow
        };

        _context.ProductStockTransactions.Add(txn);
        await _context.SaveChangesAsync(ct);

        // If this is an outflow (e.g. POS sale) and FEFO allocation is requested:
        if (allocateFefo && quantityChange < 0)
        {
            var absQty = Math.Abs(quantityChange);
            var allocResult = await _lotService.AllocateFinishedProductFefoAsync(branchId, menuItemId, absQty, txn.Id, ct);
            if (allocResult.IsFailure)
            {
                // We do not fail the sale transaction if lots run out in a rush, but record the allocations possible
            }
            else
            {
                foreach (var alloc in allocResult.Value)
                {
                    _context.ProductLotAllocations.Add(alloc);
                }
                await _context.SaveChangesAsync(ct);
            }
        }

        return Result<ProductStockTransaction>.Success(txn);
    }
}
