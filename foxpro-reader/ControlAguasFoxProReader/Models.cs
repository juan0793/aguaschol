using System.Text.Json.Serialization;

namespace ControlAguasFoxProReader;

internal sealed class ReaderConfig
{
    public FoxProConfig FoxPro { get; set; } = new();
    public ControlAguasConfig ControlAguas { get; set; } = new();
    public ImportConfig Importacion { get; set; } = new();
}
internal sealed class FoxProConfig { public string DataPath { get; set; } = ""; public string TableName { get; set; } = "maestro"; }
internal sealed class ControlAguasConfig { public string ApiUrl { get; set; } = "https://aguaschol-production.up.railway.app/"; public string ApiKey { get; set; } = ""; }
internal sealed class ImportConfig { public int BatchSize { get; set; } = 500; public int TimeoutSeconds { get; set; } = 120; public int MaxRetries { get; set; } = 3; }
internal sealed record SendResult(int Blocks, int Rejected);
internal sealed record SyncRequest(int Id);

internal sealed class FoxProRow
{
    [JsonPropertyName("numero_fila")] public int NumeroFila { get; set; }
    [JsonPropertyName("catastral")] public string Catastral { get; set; } = "";
    [JsonPropertyName("abonado")] public string Abonado { get; set; } = "";
    [JsonPropertyName("inquilino")] public string Inquilino { get; set; } = "";
    [JsonPropertyName("des_coloni")] public string Colonia { get; set; } = "";
    [JsonPropertyName("agua")] public string Agua { get; set; } = "";
    [JsonPropertyName("alca")] public string Alcantarillado { get; set; } = "";
    [JsonPropertyName("barr")] public string Barrido { get; set; } = "";
    [JsonPropertyName("tren")] public string TrenAseo { get; set; } = "";
    [JsonPropertyName("bomb")] public string Bombeo { get; set; } = "";
    [JsonPropertyName("valor")] public decimal Valor { get; set; }
    [JsonPropertyName("intereses")] public decimal Intereses { get; set; }
}
