namespace SugarSociety.Service.Email;

public interface IEmailService
{
    Task SendConfirmationEmailAsync(string email, string token);
}
