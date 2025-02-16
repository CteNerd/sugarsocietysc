using SendGrid;
using Microsoft.Extensions.Options;
using SendGrid.Helpers.Mail;
using SugarSociety.Models;

namespace SugarSociety.Service.Email;

public class SendGridEmailService : IEmailService
{
    private readonly ISendGridClient _sendGridClient;
    private readonly AppSettings _appSettings;

    public SendGridEmailService(ISendGridClient sendGridClient, IOptions<AppSettings> appSettings)
    {
        _sendGridClient = sendGridClient;
        _appSettings = appSettings.Value;
    }

    public async Task SendConfirmationEmailAsync(string email, string token)
    {
        var msg = new SendGridMessage
        {
            From = new EmailAddress(_appSettings.SendGrid.FromEmail, "Sugar Society"),
            Subject = "Confirm your email",
            PlainTextContent = $"Please confirm your email by clicking this link: {_appSettings.AppUrl}/confirm-email?email={email}&token={token}"
        };
        msg.AddTo(new EmailAddress(email));

        await _sendGridClient.SendEmailAsync(msg);
    }
}
