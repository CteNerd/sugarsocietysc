using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SugarSociety.Service.Email;
using Microsoft.Extensions.Options;
using SugarSociety.Models;
using BCrypt.Net;

namespace SugarSociety.Service.Authentication;

public class AuthenticationService : IAuthenticationService
{
    private readonly IEmailService _emailService;
    private readonly AppSettings _appSettings;
    private readonly ApplicationDbContext _context;

    public AuthenticationService(IEmailService emailService, IOptions<AppSettings> appSettings, ApplicationDbContext context)
    {
        _emailService = emailService;
        _appSettings = appSettings.Value;
        _context = context;
    }

    public async Task<AuthResult> RegisterUserAsync(RegisterRequest request)
    {
        // Validate user doesn't exist
        if (await _context.Users.AnyAsync(u => u.Email == request.Email))
            return new AuthResult { Success = false, Message = "User already exists" };

        // Create user
        var user = new User
        {
            Email = request.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            EmailConfirmationToken = GenerateEmailToken()
        };

        await _context.Users.AddAsync(user);
        await _context.SaveChangesAsync();

        // Send confirmation email
        await _emailService.SendConfirmationEmailAsync(user.Email, user.EmailConfirmationToken);

        return new AuthResult { Success = true, Message = "Registration successful. Please check your email." };
    }

    public async Task<AuthResult> ConfirmEmailAsync(string email, string token)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user == null || user.EmailConfirmationToken != token)
            return new AuthResult { Success = false, Message = "Invalid confirmation link" };

        user.EmailConfirmed = true;
        user.EmailConfirmationToken = string.Empty;
        await _context.SaveChangesAsync();

        return new AuthResult { Success = true, Message = "Email confirmed successfully" };
    }

    public async Task<AuthResult> LoginAsync(LoginRequest request)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return new AuthResult { Success = false, Message = "Invalid credentials" };

        if (!user.EmailConfirmed)
            return new AuthResult { Success = false, Message = "Please confirm your email first" };

        var token = GenerateJwtToken(user);
        return new AuthResult { Success = true, Token = token };
    }

    public async Task<AuthResult> SocialLoginAsync(string provider, SocialLoginRequest request)
    {
        // Implement social login validation logic here
        // This will vary depending on the provider (Google, Facebook, Apple)
        throw new NotImplementedException();
    }

    private string GenerateJwtToken(User user)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.ASCII.GetBytes(_appSettings.Jwt.Secret);
        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString())
            }),
            Expires = DateTime.UtcNow.AddDays(7),
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }

    private string GenerateEmailToken() => Guid.NewGuid().ToString("N");
}
