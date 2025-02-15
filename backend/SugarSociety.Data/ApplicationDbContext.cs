using Microsoft.EntityFrameworkCore;

namespace SugarSociety.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        // Define your DbSets here
        public DbSet<HealthCheckRecord> HealthCheckRecords { get; set; }
    }
}