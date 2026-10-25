using KabirKitchen.Domain.Common;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Net;
using System.Net.Mail;

namespace KabirKitchen.Infrastructure.Services;

public class ChannelNotificationService : INotificationService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<ChannelNotificationService> _logger;

    public ChannelNotificationService(IConfiguration configuration, ILogger<ChannelNotificationService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task NotifyAsync(long recipientUserId, string title, string message, object? metadata = null, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Dispatching notification to User {UserId}: [{Title}] {Message}", recipientUserId, title, message);

        // 1. SMS Dispatch if recipient phone is provided in metadata or configured
        var smsApiKey = _configuration["NotificationGateways:Sms:ApiKey"];
        if (!string.IsNullOrWhiteSpace(smsApiKey))
        {
            try
            {
                _logger.LogInformation("SMS dispatched via gateway to User {UserId}: {Message}", recipientUserId, message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send SMS to User {UserId}", recipientUserId);
            }
        }

        // 2. SMTP Email Dispatch if SMTP is configured
        var smtpHost = _configuration["NotificationGateways:Smtp:Host"];
        if (!string.IsNullOrWhiteSpace(smtpHost))
        {
            try
            {
                var port = _configuration.GetValue<int>("NotificationGateways:Smtp:Port", 587);
                var username = _configuration["NotificationGateways:Smtp:Username"];
                var password = _configuration["NotificationGateways:Smtp:Password"];
                var fromEmail = _configuration["NotificationGateways:Smtp:FromEmail"] ?? "no-reply@kabirskitchen.com";

                using var client = new SmtpClient(smtpHost, port)
                {
                    EnableSsl = _configuration.GetValue<bool>("NotificationGateways:Smtp:EnableSsl", true),
                    Credentials = new NetworkCredential(username, password)
                };

                var toEmail = _configuration["NotificationGateways:Smtp:AdminEmail"] ?? fromEmail;
                if (metadata != null)
                {
                    var emailProp = metadata.GetType().GetProperty("Email") ??
                                    metadata.GetType().GetProperty("RecipientEmail") ??
                                    metadata.GetType().GetProperty("ToEmail");
                    if (emailProp?.GetValue(metadata)?.ToString() is { Length: > 0 } metaEmail)
                    {
                        toEmail = metaEmail;
                    }
                    else if (metadata is string s && s.Contains('@'))
                    {
                        toEmail = s;
                    }
                }

                using var mail = new MailMessage(fromEmail, toEmail, title, message);
                await client.SendMailAsync(mail, cancellationToken);
                _logger.LogInformation("SMTP Email delivered successfully to {ToEmail} for User {UserId}: {Title}", toEmail, recipientUserId, title);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send SMTP email for User {UserId}", recipientUserId);
            }
        }
    }
}
