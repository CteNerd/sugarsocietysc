using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using SugarSociety.Service;

namespace SugarSociety.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class HealthCheckController : ControllerBase
    {
        private readonly IHealthCheckService _healthCheckService;

        public HealthCheckController(IHealthCheckService healthCheckService)
        {
            _healthCheckService = healthCheckService;
        }

        /// <summary>
        /// Performs a health check.
        /// </summary>
        /// <returns>An IActionResult indicating the health status.</returns>
        [HttpGet]
        public IActionResult Check()
        {
            return Ok(new HealthCheckResult(HealthStatus.Healthy));
        }

        /// <summary>
        /// Performs an authenticated health check.
        /// </summary>
        /// <returns>An IActionResult indicating the health status.</returns>
        [Authorize]
        [HttpGet("auth-health-check")]
        public async Task<IActionResult> AuthHealthCheck()
        {
            Console.WriteLine("Auth Health check requested");
            await _healthCheckService.LogHealthCheckAsync();
            return Ok(new { Status = "Healthy", Message = "Authenticated health check passed." });
        }
    }
}
