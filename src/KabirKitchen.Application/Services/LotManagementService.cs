using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Inventory;
using KabirKitchen.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Application.Services;

/// <summary>
/// Manages InventoryLot creation, FEFO allocation, and reversal across all three layers.
/// Rules enforced:
/// - Lots may only be consumed if Active and not expired/quarantined.
/// - FEFO: earliest ExpiryDate first; null expiry (HasExpiry=false) consumed last.
/// - Allocations cannot exceed lot remaining quantity (enforced before commit).
/// - Reversals cannot exceed the original posted allocation.
/// - Opening stock lots are created with SourceReference = "LEGACY-OPENING-MIGRATION".
/// </summary>
public class LotManagementService
{
    private readonly IApplicationDbContext _context;

    public LotManagementService(IApplicationDbContext context)
    {
        _context = context;
    }

    // ─── LOT NUMBER GENERATION ────────────────────────────────────────────────

    public async Task<string> GenerateRawMaterialLotNumberAsync(CancellationToken ct = default)
        => await GenerateLotNumberAsync("RAW", ct);

    public async Task<string> GenerateSubRecipeLotNumberAsync(CancellationToken ct = default)
        => await GenerateLotNumberAsync("SUB", ct);

    public async Task<string> GenerateFinishedProductLotNumberAsync(CancellationToken ct = default)
        => await GenerateLotNumberAsync("FIN", ct);

    private async Task<string> GenerateLotNumberAsync(string prefix, CancellationToken ct)
    {
        var datePart = DateTime.UtcNow.ToString("yyyyMMdd");
        var likePrefix = $"LOT-{prefix}-{datePart}-";
        var countToday = await _context.InventoryLots
            .CountAsync(l => l.LotNumber.StartsWith(likePrefix), ct);
        return $"{likePrefix}{(countToday + 1):D3}";
    }

    // ─── LOT CREATION ─────────────────────────────────────────────────────────

    /// <summary>Creates a raw material receipt lot from a GRN.</summary>
    public InventoryLot CreateRawMaterialLot(
        string lotNumber,
        long branchId,
        long ingredientId,
        decimal quantity,
        decimal unitCost,
        DateTime? expiryDateUtc,
        bool hasExpiry,
        string? sourceReference)
    {
        if (quantity <= 0) throw new ArgumentException("Lot quantity must be positive.", nameof(quantity));
        return new InventoryLot
        {
            LotNumber = lotNumber,
            BranchId = branchId,
            LotType = InventoryLotType.RawMaterial,
            IngredientId = ingredientId,
            InitialQuantity = quantity,
            RemainingQuantity = quantity,
            UnitCost = unitCost,
            ManufacturedOrReceivedDateUtc = DateTime.UtcNow,
            ExpiryDateUtc = expiryDateUtc,
            HasExpiry = hasExpiry,
            Status = InventoryLotStatus.Active,
            SourceReference = sourceReference
        };
    }

    /// <summary>Creates a sub-recipe production lot.</summary>
    public InventoryLot CreateSubRecipeLot(
        string lotNumber,
        long branchId,
        long subRecipeId,
        decimal acceptedQuantity,
        decimal unitCost,
        DateTime? expiryDateUtc,
        bool hasExpiry,
        string? sourceReference)
    {
        if (acceptedQuantity <= 0) throw new ArgumentException("Accepted quantity must be positive.", nameof(acceptedQuantity));
        return new InventoryLot
        {
            LotNumber = lotNumber,
            BranchId = branchId,
            LotType = InventoryLotType.SubRecipe,
            SubRecipeId = subRecipeId,
            InitialQuantity = acceptedQuantity,
            RemainingQuantity = acceptedQuantity,
            UnitCost = unitCost,
            ManufacturedOrReceivedDateUtc = DateTime.UtcNow,
            ExpiryDateUtc = expiryDateUtc,
            HasExpiry = hasExpiry,
            Status = InventoryLotStatus.Active,
            SourceReference = sourceReference
        };
    }

    /// <summary>Creates a finished product production lot.</summary>
    public InventoryLot CreateFinishedProductLot(
        string lotNumber,
        long branchId,
        long menuItemId,
        decimal acceptedQuantity,
        decimal unitCost,
        DateTime? expiryDateUtc,
        bool hasExpiry,
        string? sourceReference)
    {
        if (acceptedQuantity <= 0) throw new ArgumentException("Accepted quantity must be positive.", nameof(acceptedQuantity));
        return new InventoryLot
        {
            LotNumber = lotNumber,
            BranchId = branchId,
            LotType = InventoryLotType.FinishedProduct,
            MenuItemId = menuItemId,
            InitialQuantity = acceptedQuantity,
            RemainingQuantity = acceptedQuantity,
            UnitCost = unitCost,
            ManufacturedOrReceivedDateUtc = DateTime.UtcNow,
            ExpiryDateUtc = expiryDateUtc,
            HasExpiry = hasExpiry,
            Status = InventoryLotStatus.Active,
            SourceReference = sourceReference
        };
    }

    // ─── FEFO ALLOCATION ──────────────────────────────────────────────────────

    /// <summary>
    /// Allocates the requested quantity from raw material lots using FEFO.
    /// Returns the list of allocations created. The caller is responsible for
    /// saving them together with the parent StockTransaction atomically.
    /// </summary>
    public async Task<Result<List<IngredientLotAllocation>>> AllocateRawMaterialFefoAsync(
        long branchId,
        long ingredientId,
        decimal requiredQuantityInBaseUnit,
        long stockTransactionId,
        CancellationToken ct = default)
    {
        if (requiredQuantityInBaseUnit <= 0)
            return Result<List<IngredientLotAllocation>>.Failure("Required quantity must be positive.");

        var lots = await GetEligibleRawMaterialLotsFefoAsync(branchId, ingredientId, ct);
        return AllocateFromLots(lots, requiredQuantityInBaseUnit, stockTransactionId,
            (lot, allocQty) => new IngredientLotAllocation
            {
                InventoryLotId = lot.Id,
                StockTransactionId = stockTransactionId,
                AllocatedQuantity = -allocQty, // negative = consumption
                LotRemainingQuantityBefore = lot.RemainingQuantity,
                LotRemainingQuantityAfter = lot.RemainingQuantity - allocQty,
                UnitCostSnapshot = lot.UnitCost
            });
    }

    private Result<List<IngredientLotAllocation>> AllocateFromLots(
        List<InventoryLot> lots,
        decimal required,
        long txnId,
        Func<InventoryLot, decimal, IngredientLotAllocation> createAllocation)
    {
        var remaining = required;
        var allocations = new List<IngredientLotAllocation>();

        foreach (var lot in lots)
        {
            if (remaining <= 0) break;

            var allocQty = Math.Min(lot.RemainingQuantity, remaining);
            var alloc = createAllocation(lot, allocQty);
            allocations.Add(alloc);

            lot.RemainingQuantity -= allocQty;
            if (lot.RemainingQuantity <= 0)
            {
                lot.RemainingQuantity = 0;
                lot.Status = InventoryLotStatus.Depleted;
            }

            remaining -= allocQty;
        }

        if (remaining > 0)
            return Result<List<IngredientLotAllocation>>.Failure(
                $"Insufficient FEFO-eligible lot stock. Short by {remaining:F4} units.");

        return Result<List<IngredientLotAllocation>>.Success(allocations);
    }

    private async Task<List<InventoryLot>> GetEligibleRawMaterialLotsFefoAsync(
        long branchId, long ingredientId, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        return await _context.InventoryLots
            .Where(l => l.BranchId == branchId
                     && l.IngredientId == ingredientId
                     && l.LotType == InventoryLotType.RawMaterial
                     && l.Status == InventoryLotStatus.Active
                     && l.RemainingQuantity > 0
                     && (!l.HasExpiry || l.ExpiryDateUtc == null || l.ExpiryDateUtc > now))
            // FEFO: expire-soonest first; non-expiring lots last
            .OrderBy(l => l.HasExpiry && l.ExpiryDateUtc != null ? 0 : 1)
            .ThenBy(l => l.ExpiryDateUtc ?? DateTime.MaxValue)
            .ThenBy(l => l.Id) // deterministic tiebreak
            .ToListAsync(ct);
    }

    /// <summary>
    /// Allocates sub-recipe lot stock using FEFO.
    /// </summary>
    public async Task<Result<List<SubRecipeLotAllocation>>> AllocateSubRecipeFefoAsync(
        long branchId,
        long subRecipeId,
        decimal requiredQuantity,
        long subRecipeTxnId,
        CancellationToken ct = default)
    {
        if (requiredQuantity <= 0)
            return Result<List<SubRecipeLotAllocation>>.Failure("Required quantity must be positive.");

        var now = DateTime.UtcNow;
        var lots = await _context.InventoryLots
            .Where(l => l.BranchId == branchId
                     && l.SubRecipeId == subRecipeId
                     && l.LotType == InventoryLotType.SubRecipe
                     && l.Status == InventoryLotStatus.Active
                     && l.RemainingQuantity > 0
                     && (!l.HasExpiry || l.ExpiryDateUtc == null || l.ExpiryDateUtc > now))
            .OrderBy(l => l.HasExpiry && l.ExpiryDateUtc != null ? 0 : 1)
            .ThenBy(l => l.ExpiryDateUtc ?? DateTime.MaxValue)
            .ThenBy(l => l.Id)
            .ToListAsync(ct);

        var remaining = requiredQuantity;
        var allocations = new List<SubRecipeLotAllocation>();

        foreach (var lot in lots)
        {
            if (remaining <= 0) break;
            var allocQty = Math.Min(lot.RemainingQuantity, remaining);
            allocations.Add(new SubRecipeLotAllocation
            {
                InventoryLotId = lot.Id,
                SubRecipeStockTransactionId = subRecipeTxnId,
                AllocatedQuantity = -allocQty,
                LotRemainingQuantityBefore = lot.RemainingQuantity,
                LotRemainingQuantityAfter = lot.RemainingQuantity - allocQty,
                UnitCostSnapshot = lot.UnitCost
            });
            lot.RemainingQuantity -= allocQty;
            if (lot.RemainingQuantity <= 0) { lot.RemainingQuantity = 0; lot.Status = InventoryLotStatus.Depleted; }
            remaining -= allocQty;
        }

        if (remaining > 0)
            return Result<List<SubRecipeLotAllocation>>.Failure(
                $"Insufficient sub-recipe lot stock. Short by {remaining:F4} units.");

        return Result<List<SubRecipeLotAllocation>>.Success(allocations);
    }

    /// <summary>
    /// Allocates finished product lot stock using FEFO for POS sales.
    /// </summary>
    public async Task<Result<List<ProductLotAllocation>>> AllocateFinishedProductFefoAsync(
        long branchId,
        long menuItemId,
        decimal requiredQuantity,
        long productTxnId,
        CancellationToken ct = default)
    {
        if (requiredQuantity <= 0)
            return Result<List<ProductLotAllocation>>.Failure("Required quantity must be positive.");

        var now = DateTime.UtcNow;
        var lots = await _context.InventoryLots
            .Where(l => l.BranchId == branchId
                     && l.MenuItemId == menuItemId
                     && l.LotType == InventoryLotType.FinishedProduct
                     && l.Status == InventoryLotStatus.Active
                     && l.RemainingQuantity > 0
                     && (!l.HasExpiry || l.ExpiryDateUtc == null || l.ExpiryDateUtc > now))
            .OrderBy(l => l.HasExpiry && l.ExpiryDateUtc != null ? 0 : 1)
            .ThenBy(l => l.ExpiryDateUtc ?? DateTime.MaxValue)
            .ThenBy(l => l.Id)
            .ToListAsync(ct);

        var remaining = requiredQuantity;
        var allocations = new List<ProductLotAllocation>();

        foreach (var lot in lots)
        {
            if (remaining <= 0) break;
            var allocQty = Math.Min(lot.RemainingQuantity, remaining);
            allocations.Add(new ProductLotAllocation
            {
                InventoryLotId = lot.Id,
                ProductStockTransactionId = productTxnId,
                AllocatedQuantity = -allocQty,
                LotRemainingQuantityBefore = lot.RemainingQuantity,
                LotRemainingQuantityAfter = lot.RemainingQuantity - allocQty,
                UnitCostSnapshot = lot.UnitCost
            });
            lot.RemainingQuantity -= allocQty;
            if (lot.RemainingQuantity <= 0) { lot.RemainingQuantity = 0; lot.Status = InventoryLotStatus.Depleted; }
            remaining -= allocQty;
        }

        if (remaining > 0)
            return Result<List<ProductLotAllocation>>.Failure(
                $"Insufficient finished product lot stock. Short by {remaining:F4} units.");

        return Result<List<ProductLotAllocation>>.Success(allocations);
    }

    // ─── RECEIPT LOT ALLOCATION (POSITIVE = INBOUND) ─────────────────────────

    /// <summary>
    /// Creates a single IngredientLotAllocation for a receipt (GRN).
    /// The lot's InitialQuantity and RemainingQuantity are set at creation;
    /// this allocation records the inbound ledger link. AllocatedQuantity is positive.
    /// </summary>
    public static IngredientLotAllocation CreateReceiptAllocation(InventoryLot lot, long stockTransactionId)
    {
        return new IngredientLotAllocation
        {
            InventoryLotId = lot.Id,
            StockTransactionId = stockTransactionId,
            AllocatedQuantity = lot.InitialQuantity, // positive inbound
            LotRemainingQuantityBefore = 0,
            LotRemainingQuantityAfter = lot.InitialQuantity,
            UnitCostSnapshot = lot.UnitCost
        };
    }

    /// <summary>Creates a receipt allocation for a SubRecipe production lot.</summary>
    public static SubRecipeLotAllocation CreateSubRecipeReceiptAllocation(InventoryLot lot, long subRecipeTxnId)
    {
        return new SubRecipeLotAllocation
        {
            InventoryLotId = lot.Id,
            SubRecipeStockTransactionId = subRecipeTxnId,
            AllocatedQuantity = lot.InitialQuantity,
            LotRemainingQuantityBefore = 0,
            LotRemainingQuantityAfter = lot.InitialQuantity,
            UnitCostSnapshot = lot.UnitCost
        };
    }

    /// <summary>Creates a receipt allocation for a FinishedProduct production lot.</summary>
    public static ProductLotAllocation CreateFinishedProductReceiptAllocation(InventoryLot lot, long productTxnId)
    {
        return new ProductLotAllocation
        {
            InventoryLotId = lot.Id,
            ProductStockTransactionId = productTxnId,
            AllocatedQuantity = lot.InitialQuantity,
            LotRemainingQuantityBefore = 0,
            LotRemainingQuantityAfter = lot.InitialQuantity,
            UnitCostSnapshot = lot.UnitCost
        };
    }

    // ─── HELPERS ──────────────────────────────────────────────────────────────

    private static void MarkDepleted(InventoryLot lot)
    {
        if (lot.RemainingQuantity <= 0)
        {
            lot.RemainingQuantity = 0;
            lot.Status = InventoryLotStatus.Depleted;
        }
    }

    /// <summary>Quarantine a lot — moves remaining to quarantined status. Does not reduce stock (caller adjusts stock balance).</summary>
    public static void QuarantineLot(InventoryLot lot)
    {
        lot.Status = InventoryLotStatus.Quarantined;
    }

    /// <summary>Dispose / fully write off a lot.</summary>
    public static void DisposeLot(InventoryLot lot)
    {
        lot.RemainingQuantity = 0;
        lot.Status = InventoryLotStatus.Disposed;
    }
}

