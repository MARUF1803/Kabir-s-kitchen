using System.Globalization;
using System.Text;
using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.DTOs;

namespace KabirKitchen.Infrastructure.Services;

public class InvoicePdfService : IInvoicePdfService
{
    public byte[] GenerateA4InvoicePdf(InvoiceDto invoice)
    {
        var builder = new SimplePdfBuilder(pageWidth: 595.28f, pageHeight: 841.89f);

        // Header Background Bar
        builder.DrawRect(0, 760, 595.28f, 82, 0.047f, 0.145f, 0.110f); // Dark Green #0c251c
        builder.DrawRect(0, 756, 595.28f, 4, 0.917f, 0.345f, 0.047f); // Orange Accent #ea580c

        // Brand & Slogan
        builder.DrawText("KABIR'S KITCHEN", 36, 804, 20, isBold: true, r: 1, g: 1, b: 1);
        builder.DrawText(invoice.Restaurant.Slogan, 36, 788, 10, isBold: false, r: 0.83f, g: 0.69f, b: 0.22f); // Gold #d4af37
        builder.DrawText($"Branch: {invoice.Restaurant.BranchName} | {invoice.Restaurant.BranchPhone}", 36, 772, 8.5f, isBold: false, r: 0.85f, g: 0.90f, b: 0.88f);

        // Invoice Badge
        builder.DrawText("TAX INVOICE", 440, 804, 18, isBold: true, r: 1, g: 1, b: 1);
        builder.DrawText($"No: {invoice.InvoiceNumber}", 440, 788, 10, isBold: true, r: 0.92f, g: 0.92f, b: 0.92f);
        builder.DrawText($"Date: {invoice.FormattedDate} {invoice.FormattedTime}", 440, 772, 8.5f, isBold: false, r: 0.85f, g: 0.90f, b: 0.88f);

        // Two-column Info Box
        builder.DrawRect(36, 660, 250, 80, 0.97f, 0.98f, 0.99f); // Customer Box
        builder.DrawStrokeRect(36, 660, 250, 80, 0.85f, 0.88f, 0.91f);
        builder.DrawText("BILLED TO / CUSTOMER", 46, 725, 8.5f, isBold: true, r: 0.40f, g: 0.45f, b: 0.50f);
        builder.DrawText(string.IsNullOrWhiteSpace(invoice.CustomerName) ? "Walk-in Guest" : invoice.CustomerName, 46, 710, 11, isBold: true, r: 0.06f, g: 0.09f, b: 0.16f);
        builder.DrawText($"Phone: {invoice.CustomerPhone}", 46, 695, 9, isBold: false, r: 0.20f, g: 0.25f, b: 0.30f);
        if (!string.IsNullOrWhiteSpace(invoice.DeliveryAddress))
        {
            builder.DrawText($"Address: {Truncate(invoice.DeliveryAddress, 38)}", 46, 680, 8.5f, isBold: false, r: 0.20f, g: 0.25f, b: 0.30f);
        }

        builder.DrawRect(308, 660, 251, 80, 0.97f, 0.98f, 0.99f); // Order Details Box
        builder.DrawStrokeRect(308, 660, 251, 80, 0.85f, 0.88f, 0.91f);
        builder.DrawText("ORDER & OPERATIONAL METADATA", 318, 725, 8.5f, isBold: true, r: 0.40f, g: 0.45f, b: 0.50f);
        builder.DrawText($"Order Ref: {invoice.OrderNumber}", 318, 710, 9.5f, isBold: true, r: 0.06f, g: 0.09f, b: 0.16f);
        builder.DrawText($"Channel: {invoice.OrderType} {(string.IsNullOrWhiteSpace(invoice.DiningTableNumber) ? "" : $"| Table: {invoice.DiningTableNumber}")}", 318, 695, 9, isBold: false, r: 0.20f, g: 0.25f, b: 0.30f);
        builder.DrawText($"Cashier: {invoice.CashierStaffName} | Status: {invoice.PaymentStatus}", 318, 680, 8.5f, isBold: false, r: 0.20f, g: 0.25f, b: 0.30f);

        // Table Header
        float tableTop = 635;
        builder.DrawRect(36, tableTop - 22, 523, 22, 0.047f, 0.145f, 0.110f);
        builder.DrawText("#", 46, tableTop - 15, 9, isBold: true, r: 1, g: 1, b: 1);
        builder.DrawText("ITEM DESCRIPTION", 70, tableTop - 15, 9, isBold: true, r: 1, g: 1, b: 1);
        builder.DrawText("QTY", 370, tableTop - 15, 9, isBold: true, r: 1, g: 1, b: 1);
        builder.DrawText("PRICE (BDT)", 420, tableTop - 15, 9, isBold: true, r: 1, g: 1, b: 1);
        builder.DrawText("TOTAL (BDT)", 490, tableTop - 15, 9, isBold: true, r: 1, g: 1, b: 1);

        // Table Rows
        float currentY = tableTop - 22;
        int index = 1;
        foreach (var item in invoice.Items)
        {
            currentY -= 22;
            bool isEven = index % 2 == 0;
            if (isEven)
            {
                builder.DrawRect(36, currentY, 523, 22, 0.98f, 0.98f, 0.99f);
            }
            builder.DrawLine(36, currentY, 559, currentY, 0.90f, 0.92f, 0.94f);

            string itemNameFull = item.ItemName;
            if (!string.IsNullOrWhiteSpace(item.VariantName)) itemNameFull += $" ({item.VariantName})";
            if (item.AddOns != null && item.AddOns.Any()) itemNameFull += $" + {string.Join(", ", item.AddOns)}";

            builder.DrawText(index.ToString(), 46, currentY + 6, 8.5f, isBold: false, r: 0.3f, g: 0.3f, b: 0.3f);
            builder.DrawText(Truncate(itemNameFull, 48), 70, currentY + 6, 9, isBold: true, r: 0.1f, g: 0.15f, b: 0.2f);
            builder.DrawText(item.Quantity.ToString(), 375, currentY + 6, 9, isBold: false, r: 0.1f, g: 0.15f, b: 0.2f);
            builder.DrawText(item.UnitPrice.ToString("F2", CultureInfo.InvariantCulture), 420, currentY + 6, 9, isBold: false, r: 0.1f, g: 0.15f, b: 0.2f);
            builder.DrawText(item.LineTotal.ToString("F2", CultureInfo.InvariantCulture), 490, currentY + 6, 9, isBold: true, r: 0.1f, g: 0.15f, b: 0.2f);

            index++;
            if (currentY < 200) break; // Keep within single page for standard food orders
        }

        // Totals & Financial Breakdown
        float summaryBoxY = currentY - 140;
        builder.DrawRect(330, summaryBoxY, 229, 130, 0.97f, 0.98f, 0.99f);
        builder.DrawStrokeRect(330, summaryBoxY, 229, 130, 0.85f, 0.88f, 0.91f);

        float sY = summaryBoxY + 110;
        builder.DrawText("Subtotal:", 345, sY, 9, isBold: false, r: 0.3f, g: 0.3f, b: 0.3f);
        builder.DrawText($"BDT {invoice.SubTotal:F2}", 465, sY, 9, isBold: true, r: 0.1f, g: 0.1f, b: 0.1f);

        if (invoice.DiscountAmount > 0)
        {
            sY -= 16;
            builder.DrawText("Discount:", 345, sY, 9, isBold: false, r: 0.85f, g: 0.15f, b: 0.15f);
            builder.DrawText($"- BDT {invoice.DiscountAmount:F2}", 465, sY, 9, isBold: true, r: 0.85f, g: 0.15f, b: 0.15f);
        }

        sY -= 16;
        builder.DrawText("VAT / Tax (5%):", 345, sY, 9, isBold: false, r: 0.3f, g: 0.3f, b: 0.3f);
        builder.DrawText($"BDT {invoice.TaxAmount:F2}", 465, sY, 9, isBold: true, r: 0.1f, g: 0.1f, b: 0.1f);

        if (invoice.DeliveryFee > 0)
        {
            sY -= 16;
            builder.DrawText("Delivery Charge:", 345, sY, 9, isBold: false, r: 0.3f, g: 0.3f, b: 0.3f);
            builder.DrawText($"BDT {invoice.DeliveryFee:F2}", 465, sY, 9, isBold: true, r: 0.1f, g: 0.1f, b: 0.1f);
        }

        sY -= 22;
        builder.DrawRect(330, sY - 5, 229, 24, 0.047f, 0.145f, 0.110f);
        builder.DrawText("GRAND TOTAL:", 345, sY, 11, isBold: true, r: 1, g: 1, b: 1);
        builder.DrawText($"BDT {invoice.GrandTotal:F2}", 455, sY, 12, isBold: true, r: 1, g: 0.8f, b: 0.2f); // Gold

        sY -= 20;
        builder.DrawText($"Paid: BDT {invoice.PaidAmount:F2} | Due: BDT {invoice.OutstandingAmount:F2}", 345, sY, 8.5f, isBold: true, r: 0.1f, g: 0.5f, b: 0.2f);

        // Verification & Tax Notice (Left Side)
        builder.DrawText("STATUTORY BUSINESS INFORMATION", 36, summaryBoxY + 115, 8.5f, isBold: true, r: 0.4f, g: 0.45f, b: 0.5f);
        builder.DrawText($"BIN No: {invoice.Restaurant.BinNumber} | Trade License: {invoice.Restaurant.TradeLicense}", 36, summaryBoxY + 100, 8, isBold: false, r: 0.3f, g: 0.3f, b: 0.3f);
        builder.DrawText("Scan or verify your authentic tax invoice online:", 36, summaryBoxY + 85, 8, isBold: false, r: 0.3f, g: 0.3f, b: 0.3f);
        builder.DrawText(invoice.QrVerificationUrl, 36, summaryBoxY + 70, 7.5f, isBold: true, r: 0.1f, g: 0.4f, b: 0.7f);

        // Print Audit Note
        builder.DrawText($"Print Copy #{invoice.PrintCount + 1} | Printed: {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC", 36, summaryBoxY + 45, 7.5f, isBold: false, r: 0.55f, g: 0.6f, b: 0.65f);

        // Footer Banner
        builder.DrawRect(0, 0, 595.28f, 40, 0.047f, 0.145f, 0.110f);
        builder.DrawText(invoice.ThankYouMessage, 110, 16, 9.5f, isBold: true, r: 1, g: 1, b: 1);

        return builder.Build();
    }

    public byte[] GenerateThermalReceiptPdf(InvoiceDto invoice, int widthMm = 80)
    {
        // 80mm ~ 226 pt, 58mm ~ 164 pt
        float pageWidth = widthMm == 58 ? 164.4f : 226.7f;
        float pageHeight = 450 + (invoice.Items.Count * 24); // Dynamic length
        var builder = new SimplePdfBuilder(pageWidth, pageHeight);

        float y = pageHeight - 25;
        builder.DrawText("KABIR'S KITCHEN", (pageWidth / 2) - 45, y, 12, isBold: true, r: 0, g: 0, b: 0);
        y -= 14;
        builder.DrawText(Truncate(invoice.Restaurant.BranchName, 26), (pageWidth / 2) - 40, y, 8, isBold: false, r: 0.2f, g: 0.2f, b: 0.2f);
        y -= 12;
        builder.DrawText($"Tel: {invoice.Restaurant.BranchPhone}", (pageWidth / 2) - 35, y, 7.5f, isBold: false, r: 0.3f, g: 0.3f, b: 0.3f);
        y -= 12;
        builder.DrawText($"BIN: {invoice.Restaurant.BinNumber}", (pageWidth / 2) - 42, y, 7, isBold: false, r: 0.3f, g: 0.3f, b: 0.3f);

        y -= 12;
        builder.DrawLine(10, y, pageWidth - 10, y, 0.2f, 0.2f, 0.2f);
        y -= 14;
        builder.DrawText($"INV: {invoice.InvoiceNumber}", 10, y, 8, isBold: true, r: 0, g: 0, b: 0);
        y -= 11;
        builder.DrawText($"Date: {invoice.FormattedDate} {invoice.FormattedTime}", 10, y, 7.5f, isBold: false, r: 0.2f, g: 0.2f, b: 0.2f);
        y -= 11;
        builder.DrawText($"Type: {invoice.OrderType} | Staff: {Truncate(invoice.CashierStaffName ?? "POS", 12)}", 10, y, 7.5f, isBold: false, r: 0.2f, g: 0.2f, b: 0.2f);

        if (!string.IsNullOrWhiteSpace(invoice.CustomerName) && invoice.CustomerName != "Walk-in Guest")
        {
            y -= 11;
            builder.DrawText($"Cust: {Truncate(invoice.CustomerName, 18)} ({invoice.CustomerPhone})", 10, y, 7.5f, isBold: false, r: 0.2f, g: 0.2f, b: 0.2f);
        }

        y -= 10;
        builder.DrawLine(10, y, pageWidth - 10, y, 0.2f, 0.2f, 0.2f);

        // Line Items Header
        y -= 13;
        builder.DrawText("Item", 10, y, 7.5f, isBold: true, r: 0, g: 0, b: 0);
        builder.DrawText("Qty", pageWidth - 70, y, 7.5f, isBold: true, r: 0, g: 0, b: 0);
        builder.DrawText("Total", pageWidth - 38, y, 7.5f, isBold: true, r: 0, g: 0, b: 0);
        y -= 8;
        builder.DrawLine(10, y, pageWidth - 10, y, 0.7f, 0.7f, 0.7f);

        foreach (var item in invoice.Items)
        {
            y -= 14;
            string name = item.ItemName;
            if (!string.IsNullOrWhiteSpace(item.VariantName)) name += $" ({item.VariantName})";
            builder.DrawText(Truncate(name, widthMm == 58 ? 16 : 24), 10, y, 7.5f, isBold: false, r: 0, g: 0, b: 0);
            builder.DrawText(item.Quantity.ToString(), pageWidth - 65, y, 7.5f, isBold: false, r: 0, g: 0, b: 0);
            builder.DrawText(item.LineTotal.ToString("F0", CultureInfo.InvariantCulture), pageWidth - 38, y, 7.5f, isBold: true, r: 0, g: 0, b: 0);
        }

        y -= 10;
        builder.DrawLine(10, y, pageWidth - 10, y, 0.2f, 0.2f, 0.2f);

        // Summary
        y -= 13;
        builder.DrawText("Subtotal:", 10, y, 7.5f, isBold: false, r: 0.2f, g: 0.2f, b: 0.2f);
        builder.DrawText($"৳{invoice.SubTotal:F2}", pageWidth - 48, y, 7.5f, isBold: true, r: 0, g: 0, b: 0);

        if (invoice.DiscountAmount > 0)
        {
            y -= 11;
            builder.DrawText("Discount:", 10, y, 7.5f, isBold: false, r: 0.2f, g: 0.2f, b: 0.2f);
            builder.DrawText($"-৳{invoice.DiscountAmount:F2}", pageWidth - 48, y, 7.5f, isBold: true, r: 0, g: 0, b: 0);
        }

        y -= 11;
        builder.DrawText("VAT (5%):", 10, y, 7.5f, isBold: false, r: 0.2f, g: 0.2f, b: 0.2f);
        builder.DrawText($"৳{invoice.TaxAmount:F2}", pageWidth - 48, y, 7.5f, isBold: true, r: 0, g: 0, b: 0);

        if (invoice.DeliveryFee > 0)
        {
            y -= 11;
            builder.DrawText("Delivery:", 10, y, 7.5f, isBold: false, r: 0.2f, g: 0.2f, b: 0.2f);
            builder.DrawText($"৳{invoice.DeliveryFee:F2}", pageWidth - 48, y, 7.5f, isBold: true, r: 0, g: 0, b: 0);
        }

        y -= 14;
        builder.DrawLine(10, y, pageWidth - 10, y, 0, 0, 0);
        y -= 14;
        builder.DrawText("TOTAL AMOUNT:", 10, y, 9, isBold: true, r: 0, g: 0, b: 0);
        builder.DrawText($"৳{invoice.GrandTotal:F2}", pageWidth - 55, y, 10, isBold: true, r: 0, g: 0, b: 0);

        y -= 13;
        builder.DrawText($"Paid: ৳{invoice.PaidAmount:F2} | Due: ৳{invoice.OutstandingAmount:F2}", 10, y, 7.5f, isBold: true, r: 0.1f, g: 0.4f, b: 0.1f);

        y -= 14;
        builder.DrawLine(10, y, pageWidth - 10, y, 0.2f, 0.2f, 0.2f);
        y -= 16;
        builder.DrawText("Thank you for your visit!", (pageWidth / 2) - 45, y, 8, isBold: true, r: 0, g: 0, b: 0);
        y -= 11;
        builder.DrawText("100% Halal & Fresh Daily", (pageWidth / 2) - 40, y, 7, isBold: false, r: 0.3f, g: 0.3f, b: 0.3f);
        y -= 11;
        builder.DrawText($"Verify: {Truncate(invoice.QrVerificationUrl, 30)}", 10, y, 6.5f, isBold: false, r: 0.4f, g: 0.4f, b: 0.4f);

        return builder.Build();
    }

    private static string Truncate(string value, int maxChars)
    {
        if (string.IsNullOrEmpty(value)) return "";
        return value.Length <= maxChars ? value : value[..(maxChars - 3)] + "...";
    }
}

/// <summary>
/// Lightweight, reliable pure C# PDF 1.4 document builder without native dependencies.
/// </summary>
internal class SimplePdfBuilder
{
    private readonly float _width;
    private readonly float _height;
    private readonly StringBuilder _contentStream = new();

    public SimplePdfBuilder(float pageWidth, float pageHeight)
    {
        _width = pageWidth;
        _height = pageHeight;
    }

    public void DrawText(string text, float x, float y, float fontSize, bool isBold = false, float r = 0, float g = 0, float b = 0)
    {
        string fontName = isBold ? "/F2" : "/F1";
        string escaped = EscapePdfString(text);

        _contentStream.AppendLine("BT");
        _contentStream.AppendLine(string.Format(CultureInfo.InvariantCulture, "{0:F3} {1:F3} {2:F3} rg", r, g, b));
        _contentStream.AppendLine(string.Format(CultureInfo.InvariantCulture, "{0} {1:F1} Tf", fontName, fontSize));
        _contentStream.AppendLine(string.Format(CultureInfo.InvariantCulture, "{0:F2} {1:F2} Td", x, y));
        _contentStream.AppendLine($"({escaped}) Tj");
        _contentStream.AppendLine("ET");
    }

    public void DrawRect(float x, float y, float w, float h, float r, float g, float b)
    {
        _contentStream.AppendLine(string.Format(CultureInfo.InvariantCulture, "{0:F3} {1:F3} {2:F3} rg", r, g, b));
        _contentStream.AppendLine(string.Format(CultureInfo.InvariantCulture, "{0:F2} {1:F2} {2:F2} {3:F2} re", x, y, w, h));
        _contentStream.AppendLine("f");
    }

    public void DrawStrokeRect(float x, float y, float w, float h, float r, float g, float b)
    {
        _contentStream.AppendLine(string.Format(CultureInfo.InvariantCulture, "{0:F3} {1:F3} {2:F3} RG", r, g, b));
        _contentStream.AppendLine("0.75 w");
        _contentStream.AppendLine(string.Format(CultureInfo.InvariantCulture, "{0:F2} {1:F2} {2:F2} {3:F2} re", x, y, w, h));
        _contentStream.AppendLine("s");
    }

    public void DrawLine(float x1, float y1, float x2, float y2, float r, float g, float b)
    {
        _contentStream.AppendLine(string.Format(CultureInfo.InvariantCulture, "{0:F3} {1:F3} {2:F3} RG", r, g, b));
        _contentStream.AppendLine("0.5 w");
        _contentStream.AppendLine(string.Format(CultureInfo.InvariantCulture, "{0:F2} {1:F2} m", x1, y1));
        _contentStream.AppendLine(string.Format(CultureInfo.InvariantCulture, "{0:F2} {1:F2} l", x2, y2));
        _contentStream.AppendLine("s");
    }

    public byte[] Build()
    {
        var contentBytes = Encoding.ASCII.GetBytes(_contentStream.ToString());
        var objects = new List<string>();

        // 1: Catalog
        objects.Add("<< /Type /Catalog /Pages 2 0 R >>");

        // 2: Pages
        objects.Add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");

        // 3: Page
        objects.Add(string.Format(CultureInfo.InvariantCulture,
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {0:F2} {1:F2}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>",
            _width, _height));

        // 4: Stream Contents
        objects.Add(string.Format(CultureInfo.InvariantCulture,
            "<< /Length {0} >>\r\nstream\r\n{1}\r\nendstream",
            contentBytes.Length, _contentStream.ToString()));

        // 5: Font F1 (Helvetica Regular)
        objects.Add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");

        // 6: Font F2 (Helvetica Bold)
        objects.Add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

        var ms = new MemoryStream();
        using var writer = new StreamWriter(ms, Encoding.ASCII, 1024, leaveOpen: true);

        writer.Write("%PDF-1.4\r\n");
        var offsets = new List<long>();

        for (int i = 0; i < objects.Count; i++)
        {
            writer.Flush();
            offsets.Add(ms.Position);
            writer.Write($"{i + 1} 0 obj\r\n{objects[i]}\r\nendobj\r\n");
        }

        writer.Flush();
        long startXref = ms.Position;
        writer.Write($"xref\r\n0 {objects.Count + 1}\r\n0000000000 65535 f\r\n");
        foreach (var offset in offsets)
        {
            writer.Write($"{offset:D10} 00000 n\r\n");
        }

        writer.Write($"trailer\r\n<< /Size {objects.Count + 1} /Root 1 0 R >>\r\nstartxref\r\n{startXref}\r\n%%EOF\r\n");
        writer.Flush();

        return ms.ToArray();
    }

    private static string EscapePdfString(string input)
    {
        if (string.IsNullOrEmpty(input)) return "";
        // Clean non-ASCII to ASCII equivalents
        var sb = new StringBuilder();
        foreach (char c in input)
        {
            if (c == '(' || c == ')' || c == '\\')
            {
                sb.Append('\\').Append(c);
            }
            else if (c >= 32 && c <= 126)
            {
                sb.Append(c);
            }
            else if (c == '৳')
            {
                sb.Append("Tk"); // Transliterate Taka currency symbol for standard PDF Type1 fonts
            }
            else
            {
                sb.Append(' ');
            }
        }
        return sb.ToString();
    }
}
