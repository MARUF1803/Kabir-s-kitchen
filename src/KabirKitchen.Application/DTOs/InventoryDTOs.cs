using KabirKitchen.Domain.Enums;

namespace KabirKitchen.Application.DTOs;

public record BranchIngredientStockDto(
    long Id,
    long BranchId,
    string BranchName,
    long IngredientId,
    string IngredientName,
    UnitType BaseUnit,
    decimal CurrentStockQuantity,
    decimal ReservedQuantity,
    decimal AvailableQuantity,
    decimal MinimumAlertStock,
    bool IsLowStock,
    decimal LastPurchaseCost,
    decimal MovingAverageCost
);

public record StockTransactionRequestDto(
    long BranchId,
    long IngredientId,
    StockTransactionType TransactionType,
    decimal QuantityChange,
    UnitType UnitUsed,
    decimal UnitCost,
    string? ReferenceDocumentType,
    string? ReferenceDocumentNumber,
    string? Remarks
);

public record WhatCanWeMakeItemDto(
    long MenuItemId,
    string MenuItemName,
    string? VariantName,
    decimal Price,
    int MaxPossiblePortions, // e.g. "We have enough chicken & noodles to make 14 portions"
    bool IsFullyAvailable,   // true if >= 1 portion can be made
    List<IngredientShortageDto> Shortages
);

public record IngredientShortageDto(
    string IngredientName,
    decimal RequiredPerPortion,
    UnitType UnitUsed,
    decimal AvailableOnBranch,
    decimal MissingQuantity
);
