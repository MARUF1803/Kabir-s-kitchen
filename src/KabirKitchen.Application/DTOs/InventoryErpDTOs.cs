using KabirKitchen.Domain.Enums;

namespace KabirKitchen.Application.DTOs;

// ─── SubRecipe DTOs ──────────────────────────────────────────────────────────

public record SubRecipeDto(
    long Id,
    string Name,
    string Code,
    string? Description,
    UnitType BaseUnit,
    decimal StandardBatchYield,
    StorageCondition StorageCondition,
    int? ShelfLifeHours,
    int? ShelfLifeDays,
    bool HasExpiry,
    bool IsActive,
    List<SubRecipeIngredientDto> Ingredients
);

public record SubRecipeIngredientDto(
    long Id,
    long SubRecipeId,
    long? IngredientId,
    string? IngredientName,
    long? ChildSubRecipeId,
    string? ChildSubRecipeName,
    decimal Quantity,
    UnitType Unit,
    decimal QuantityInBaseUnit,
    string? Notes
);

public record CreateSubRecipeDto(
    string Name,
    string Code,
    string? Description,
    UnitType BaseUnit,
    decimal StandardBatchYield,
    StorageCondition StorageCondition,
    int? ShelfLifeHours,
    int? ShelfLifeDays,
    bool HasExpiry,
    List<CreateSubRecipeIngredientDto> Ingredients
);

public record CreateSubRecipeIngredientDto(
    long? IngredientId,
    long? ChildSubRecipeId,
    decimal Quantity,
    UnitType Unit,
    string? Notes
);

public record BranchSubRecipeStockDto(
    long Id,
    long BranchId,
    string BranchName,
    long SubRecipeId,
    string SubRecipeName,
    string SubRecipeCode,
    UnitType BaseUnit,
    decimal CurrentStockQuantity,
    decimal ReservedQuantity,
    decimal QuarantinedQuantity,
    decimal AvailableQuantity,
    decimal MinimumAlertStock,
    decimal MovingAverageCostPerUnit
);

// ─── Finished Product Stock DTOs ────────────────────────────────────────────

public record BranchProductStockDto(
    long Id,
    long BranchId,
    string BranchName,
    long MenuItemId,
    string MenuItemName,
    long? MenuItemVariantId,
    string? VariantName,
    decimal CurrentStockQuantity,
    decimal ReservedQuantity,
    decimal QuarantinedQuantity,
    decimal AvailableQuantity,
    decimal MinimumAlertStock,
    decimal MovingAverageCostPerUnit
);

// ─── Inventory Lot DTOs ─────────────────────────────────────────────────────

public record InventoryLotDto(
    long Id,
    string LotNumber,
    long BranchId,
    string BranchName,
    InventoryLotType LotType,
    long? IngredientId,
    string? IngredientName,
    long? SubRecipeId,
    string? SubRecipeName,
    long? MenuItemId,
    string? MenuItemName,
    decimal InitialQuantity,
    decimal RemainingQuantity,
    decimal UnitCost,
    DateTime ManufacturedOrReceivedDateUtc,
    DateTime? ExpiryDateUtc,
    bool HasExpiry,
    InventoryLotStatus Status,
    string? StorageLocation,
    string? SourceReference,
    bool IsExpired
);

public record QuarantineLotRequestDto(
    long LotId,
    string Reason
);

public record AdjustLotRequestDto(
    long LotId,
    decimal QuantityChange,
    string Reason
);

// ─── Production Batch DTOs ──────────────────────────────────────────────────

public record ProductionBatchDto(
    long Id,
    string BatchNumber,
    long BranchId,
    string BranchName,
    ProductionTargetType TargetType,
    long? SubRecipeId,
    string? SubRecipeName,
    long? MenuItemId,
    string? MenuItemName,
    long? MenuItemVariantId,
    string? VariantName,
    ProductionBatchStatus Status,
    decimal PlannedQuantity,
    decimal ActualProducedQuantity,
    decimal RejectedQuantity,
    decimal AcceptedQuantity,
    DateTime? ScheduledStartUtc,
    DateTime? CompletedAtUtc,
    DateTime? PostedAtUtc,
    long CreatedByUserId,
    string? ProductionNotes,
    string? RejectionReason,
    bool IsPosted,
    List<ProductionBatchIngredientDto> ConsumedIngredients,
    List<ProductionBatchSubRecipeDto> ConsumedSubRecipes,
    ProductionBatchCostSnapshotDto? CostSnapshot
);

public record ProductionBatchIngredientDto(
    long Id,
    long IngredientId,
    string IngredientName,
    decimal PlannedQuantity,
    decimal ActualQuantityConsumed,
    UnitType UnitUsed,
    decimal QuantityInBaseUnit,
    decimal UnitCostSnapshot,
    decimal TotalCost
);

public record ProductionBatchSubRecipeDto(
    long Id,
    long SubRecipeId,
    string SubRecipeName,
    decimal PlannedQuantity,
    decimal ActualQuantityConsumed,
    UnitType UnitUsed,
    decimal UnitCostSnapshot,
    decimal TotalCost
);

public record ProductionBatchCostSnapshotDto(
    long Id,
    long ProductionBatchId,
    decimal RawMaterialsCostTotal,
    decimal SubRecipesCostTotal,
    decimal ReusableMaterialsCostTotal,
    decimal DirectLaborCostTotal,
    decimal UtilityCostTotal,
    decimal PackagingCostTotal,
    decimal OtherOverheadCostTotal,
    decimal PlannedQuantity,
    decimal ActualProducedQuantity,
    decimal RejectedQuantity,
    decimal AcceptedQuantity,
    decimal IngredientOnlyTotalCost,
    decimal? IngredientOnlyUnitCost,
    decimal FullProductionTotalCost,
    decimal? FullProductionUnitCost,
    decimal TotalBatchSpoilageLoss,
    bool IsImmutable,
    long? CorrectionOfSnapshotId,
    DateTime SnapshotTimestampUtc
);

public record CreateProductionBatchRequestDto(
    long BranchId,
    ProductionTargetType TargetType,
    long? SubRecipeId,
    long? MenuItemId,
    long? MenuItemVariantId,
    decimal PlannedQuantity,
    DateTime? ScheduledStartUtc,
    string? ProductionNotes
);

public record CompleteProductionBatchRequestDto(
    decimal ActualProducedQuantity,
    decimal RejectedQuantity,
    string? RejectionReason = null,
    DateTime? ExpiryDateUtc = null,
    List<ConsumedIngredientInputDto>? ConsumedIngredients = null,
    List<ConsumedSubRecipeInputDto>? ConsumedSubRecipes = null,
    decimal? ReusableMaterialQuantityConsumed = null,
    long? EquipmentReservoirId = null,
    decimal DirectLaborCost = 0,
    decimal UtilityCost = 0,
    decimal PackagingCost = 0,
    decimal OtherOverheadCost = 0,
    string? ProductionNotes = null
);

public record ConsumedIngredientInputDto(
    long IngredientId,
    decimal ActualQuantityConsumed,
    UnitType UnitUsed
);

public record ConsumedSubRecipeInputDto(
    long SubRecipeId,
    decimal ActualQuantityConsumed,
    UnitType UnitUsed
);

public record PostProductionBatchRequestDto(
    string? IdempotencyKey
);

// ─── Equipment Reservoir DTOs ────────────────────────────────────────────────

public record EquipmentReservoirDto(
    long Id,
    long BranchId,
    string BranchName,
    string EquipmentName,
    string? EquipmentCode,
    long IngredientId,
    string IngredientName,
    decimal CurrentFluidQuantity,
    decimal CurrentUnitCost,
    decimal MaxCapacity,
    DateTime? LastCleanedOrReplacedUtc,
    bool IsActive
);

public record EquipmentReservoirTransactionDto(
    long Id,
    long EquipmentReservoirId,
    ReservoirTransactionType TransactionType,
    decimal QuantityChange,
    decimal QuantityBefore,
    decimal QuantityAfter,
    decimal UnitCostAtTransaction,
    decimal WeightedAverageCostAfter,
    long? ProductionBatchId,
    long? SourceInventoryLotId,
    string? Remarks,
    DateTime TransactionDateUtc
);

public record TransferToReservoirRequestDto(
    long EquipmentReservoirId,
    decimal Quantity,
    long? SourceInventoryLotId,
    string? Remarks
);

public record ReservoirAbsorptionRequestDto(
    long EquipmentReservoirId,
    decimal QuantityAbsorbed,
    long? ProductionBatchId,
    string? Remarks
);

public record ReservoirDiscardSludgeRequestDto(
    long EquipmentReservoirId,
    decimal QuantityDiscarded,
    string? Remarks
);

public record DrainReservoirRequestDto(
    long EquipmentReservoirId,
    string? Remarks
);

// ─── UOM Conversion DTOs ────────────────────────────────────────────────────

public record IngredientUomConversionDto(
    long Id,
    long IngredientId,
    string IngredientName,
    string FromUnit,
    UnitType ToBaseUnit,
    decimal Multiplier,
    bool IsDefaultPurchaseUnit,
    string? PackageDescription,
    bool IsActive
);

public record CreateIngredientUomConversionDto(
    long IngredientId,
    string FromUnit,
    UnitType ToBaseUnit,
    decimal Multiplier,
    bool IsDefaultPurchaseUnit,
    string? PackageDescription
);
