using Microsoft.EntityFrameworkCore;

namespace SugarSociety.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<User> Users { get; set; } // Add this line

        // Define your DbSets here
        public DbSet<HealthCheckRecord> HealthCheckRecords { get; set; }
    }
}