namespace SugarSociety.Models;

public class AppSettings
{
    public SendGridSettings SendGrid { get; set; }
    public JwtSettings Jwt { get; set; }
    public string AppUrl { get; set; }
}

public class SendGridSettings
{
    public string ApiKey { get; set; }
    public string FromEmail { get; set; }
}

public class JwtSettings
{
    public string Secret { get; set; }
}
