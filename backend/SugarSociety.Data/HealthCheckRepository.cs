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
            Console.WriteLine("Logging health check");
            var record = new HealthCheckRecord
            {
                Timestamp = DateTime.UtcNow
            };

            _context.HealthCheckRecords.Add(record);
            Console.WriteLine("Logged health check");
            await _context.SaveChangesAsync();
        }
    }
}
