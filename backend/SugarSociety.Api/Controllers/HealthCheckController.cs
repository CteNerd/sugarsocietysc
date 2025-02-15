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

        [HttpGet]
        public async Task<IActionResult> Check()
        {
            await _healthCheckService.LogHealthCheckAsync();
            return Ok(new HealthCheckResult(HealthStatus.Healthy));
        }
    }
}
