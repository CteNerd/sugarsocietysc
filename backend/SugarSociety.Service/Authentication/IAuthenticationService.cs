namespace SugarSociety.Service.Authentication;

public interface IAuthenticationService
{
    Task<AuthResult> RegisterUserAsync(RegisterRequest request);
    Task<AuthResult> ConfirmEmailAsync(string email, string token);
    Task<AuthResult> LoginAsync(LoginRequest request);
    Task<AuthResult> SocialLoginAsync(string provider, SocialLoginRequest request);
}
