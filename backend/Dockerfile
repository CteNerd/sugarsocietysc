FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY . .
RUN dotnet restore "backend/SignatureBeauty.Api/SignatureBeauty.Api.csproj"
RUN dotnet build "backend/SignatureBeauty.Api/SignatureBeauty.Api.csproj" -c Development -o /app/build

FROM build AS publish
RUN dotnet publish "backend/SignatureBeauty.Api/SignatureBeauty.Api.csproj" -c Development -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "SignatureBeauty.Api.dll"]