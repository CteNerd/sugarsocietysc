using Microsoft.AspNetCore.Mvc;
using SugarSociety.Service.Authentication;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthenticationService _authService;
    
    public AuthController(IAuthenticationService authService)
    {
        _authService = authService;
    }

    /// <summary>
    /// Registers a new user.
    /// </summary>
    /// <param name="request">The registration request.</param>
    /// <returns>An IActionResult indicating the result of the registration.</returns>
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        var result = await _authService.RegisterUserAsync(request);
        if (!result.Success)
            return BadRequest(result.Message);
        
        return Ok(result);
    }

    /// <summary>
    /// Confirms a user's email.
    /// </summary>
    /// <param name="request">The email confirmation request.</param>
    /// <returns>An IActionResult indicating the result of the email confirmation.</returns>
    [HttpPost("confirm-email")]
    public async Task<IActionResult> ConfirmEmail([FromBody] ConfirmEmailRequest request)
    {
        var result = await _authService.ConfirmEmailAsync(request.Email, request.Token);
        if (!result.Success)
            return BadRequest(result.Message);
        
        return Ok(result);
    }

    /// <summary>
    /// Logs in a user.
    /// </summary>
    /// <param name="request">The login request.</param>
    /// <returns>An IActionResult indicating the result of the login.</returns>
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var result = await _authService.LoginAsync(request);
        if (!result.Success)
            return Unauthorized(result.Message);
        
        return Ok(result);
    }

    /// <summary>
    /// Logs in a user using a social provider.
    /// </summary>
    /// <param name="provider">The social provider.</param>
    /// <param name="request">The social login request.</param>
    /// <returns>An IActionResult indicating the result of the social login.</returns>
    [HttpPost("login/{provider}")]
    public async Task<IActionResult> SocialLogin(string provider, [FromBody] SocialLoginRequest request)
    {
        var result = await _authService.SocialLoginAsync(provider, request);
        if (!result.Success)
            return Unauthorized(result.Message);
        
        return Ok(result);
    }
}
