using KabirKitchen.Application.DTOs;

namespace KabirKitchen.Application.Common.Interfaces;

public interface IInvoicePdfService
{
    byte[] GenerateA4InvoicePdf(InvoiceDto invoice);
    byte[] GenerateThermalReceiptPdf(InvoiceDto invoice, int widthMm = 80);
}
