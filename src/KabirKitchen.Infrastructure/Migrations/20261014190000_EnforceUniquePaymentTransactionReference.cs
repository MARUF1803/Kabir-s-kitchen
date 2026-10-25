using KabirKitchen.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KabirKitchen.Infrastructure.Migrations
{
    [DbContext(typeof(KabirKitchenDbContext))]
    [Migration("20261014190000_EnforceUniquePaymentTransactionReference")]
    public partial class EnforceUniquePaymentTransactionReference : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                IF EXISTS (
                    SELECT [TransactionReference]
                    FROM [dbo].[OrderPayments]
                    WHERE [TransactionReference] IS NOT NULL
                    GROUP BY [TransactionReference]
                    HAVING COUNT(*) > 1
                )
                    THROW 51000, 'Duplicate payment transaction references must be resolved before applying this migration.', 1;

                IF EXISTS (
                    SELECT 1
                    FROM sys.columns
                    WHERE [object_id] = OBJECT_ID(N'[dbo].[OrderPayments]')
                      AND [name] = N'TransactionReference'
                      AND [max_length] = -1
                )
                    ALTER TABLE [dbo].[OrderPayments]
                    ALTER COLUMN [TransactionReference] nvarchar(450) NULL;

                IF NOT EXISTS (
                    SELECT 1
                    FROM sys.indexes
                    WHERE [name] = N'IX_OrderPayments_TransactionReference'
                      AND [object_id] = OBJECT_ID(N'[dbo].[OrderPayments]')
                )
                    CREATE UNIQUE INDEX [IX_OrderPayments_TransactionReference]
                    ON [dbo].[OrderPayments] ([TransactionReference])
                    WHERE [TransactionReference] IS NOT NULL;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                IF EXISTS (
                    SELECT 1
                    FROM sys.indexes
                    WHERE [name] = N'IX_OrderPayments_TransactionReference'
                      AND [object_id] = OBJECT_ID(N'[dbo].[OrderPayments]')
                )
                    DROP INDEX [IX_OrderPayments_TransactionReference] ON [dbo].[OrderPayments];
                """);
        }
    }
}
