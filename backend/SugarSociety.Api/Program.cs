using Microsoft.EntityFrameworkCore;
using Serilog;
using AWS.Logger;
using AWS.Logger.SeriLog;

var builder = WebApplication.CreateBuilder(args);

// Configure Serilog
var loggerConfig = new LoggerConfiguration()
    .WriteTo.AWSSeriLog(new AWSLoggerConfig
    {
        LogGroup = "/aws/ecs/containerinsights/sugar-society/performance",
        Region = "us-east-1",
        LogStreamName= "sugar-society-api",
    });

Log.Logger = loggerConfig.CreateLogger();
builder.Host.UseSerilog();

// Add services to the container.
builder.Services.Configure<AppSettings>(builder.Configuration.GetSection("AppSettings"));

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowLocalhost",
        builder =>
        {
            builder.WithOrigins("http://localhost:3000")
                   .AllowAnyMethod()
                   .AllowAnyHeader();
        });
});

// Register MongoDB client and database
// builder.Services.AddSingleton<IMongoClient>(sp =>
// {
//     var settings = MongoClientSettings.FromConnectionString(builder.Configuration.GetConnectionString("MongoDb"));
//     return new MongoClient(settings);
// });

// Register ApplicationDbContext with PostgreSQL configuration
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(GetConnectionString()));

string GetConnectionString()
{
    var configConnectionString = builder.Configuration.GetConnectionString("DefaultConnection");
    
    if (!string.IsNullOrEmpty(configConnectionString))
    {
        return configConnectionString;
    }
    
    throw new InvalidOperationException("No connection string found in either environment variables or configuration.");
}

// Register HealthCheckRepository
builder.Services.AddScoped<IHealthCheckService, HealthCheckService>();
builder.Services.AddScoped<IHealthCheckRepository, HealthCheckRepository>();

builder.Services.AddControllers();
builder.Services.AddHealthChecks();
// builder.Services.AddScoped<IContactService, ContactService>();
// builder.Services.AddScoped<INewsService, NewsService>();
// builder.Services.AddScoped<IMessagingRepository, MessagingRepository>();
// builder.Services.AddScoped<INewsArticleRepository, NewsArticleRepository>();

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseRouting();

app.UseCors("AllowLocalhost");

app.UseAuthorization();

app.UseEndpoints(endpoints =>
{
    endpoints.MapControllers();
    endpoints.MapHealthChecks("/api/health");
});

app.Run();
