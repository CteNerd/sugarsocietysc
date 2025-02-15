namespace SugarSociety.Data
{
    public interface IHealthCheckRepository
    {
        Task AddHealthCheckRecordAsync();
    }

    public class HealthCheckRepository : IHealthCheckRepository
    {
        private readonly ApplicationDbContext _context;

        public HealthCheckRepository(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task AddHealthCheckRecordAsync()
        {
            var record = new HealthCheckRecord
            {
                Timestamp = DateTime.UtcNow
            };

            _context.HealthCheckRecords.Add(record);
            await _context.SaveChangesAsync();
        }
    }
}
