
namespace SugarSociety.Service
{
    public interface IHealthCheckService
    {
        Task LogHealthCheckAsync();
    }

    public class HealthCheckService : IHealthCheckService
    {
        private readonly IHealthCheckRepository _healthCheckRepository;

        public HealthCheckService(IHealthCheckRepository healthCheckRepository)
        {
            _healthCheckRepository = healthCheckRepository;
        }

        public async Task LogHealthCheckAsync()
        {
            await _healthCheckRepository.AddHealthCheckRecordAsync();
        }
    }
}
