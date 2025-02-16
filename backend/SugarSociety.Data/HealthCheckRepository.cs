using Microsoft.EntityFrameworkCore;
using System.Data.Common;

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

            // Check if the connection string is valid
            var connectionString = context.Database.GetConnectionString();
            if (string.IsNullOrEmpty(connectionString))
            {
                throw new ArgumentException("Invalid connection string");
            }
            else
            {
                Console.WriteLine($"Connection string is valid. First 10 chars: {connectionString[..10]}");
            }
        }

        public async Task AddHealthCheckRecordAsync()
        {
            Console.WriteLine("Logging health check");
            var record = new HealthCheckRecord
            {
                Timestamp = DateTime.UtcNow
            };

            _context.HealthCheckRecords.Add(record);
            await _context.SaveChangesAsync();
            Console.WriteLine("Logged health check");
        }
    }
}
