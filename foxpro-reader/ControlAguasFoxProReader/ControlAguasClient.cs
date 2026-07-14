using System.Globalization;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace ControlAguasFoxProReader;

internal sealed class ControlAguasClient : IDisposable
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower };
    private readonly ReaderConfig _config;
    private readonly HttpClient _http;

    internal ControlAguasClient(ReaderConfig config)
    {
        _config = config;
        _http = new HttpClient { BaseAddress = new Uri(config.ControlAguas.ApiUrl.TrimEnd('/') + "/"), Timeout = TimeSpan.FromSeconds(config.Importacion.TimeoutSeconds) };
        _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", config.ControlAguas.ApiKey);
    }

    internal async Task TestAsync()
    {
        using var response = await _http.GetAsync("api/integracion/foxpro/conexion");
        if (!response.IsSuccessStatusCode) throw new InvalidOperationException($"Control Aguas respondio {(int)response.StatusCode}. Revisa la clave de integracion.");
    }

    internal async Task<SendResult> SendAsync(List<FoxProRow> rows, string batchCode, DateTime extractedAt, Action<int, int> progress)
    {
        var size = Math.Clamp(_config.Importacion.BatchSize, 1, 1000);
        var blocks = (int)Math.Ceiling(rows.Count / (double)size);
        await PostWithRetry("api/integracion/foxpro/lotes/iniciar", new { codigo_lote = batchCode, fecha_extraccion = extractedAt, total_bloques = blocks, total_registros = rows.Count });
        for (var index = 0; index < blocks; index++)
        {
            var records = rows.Skip(index * size).Take(size).ToList();
            await PostWithRetry($"api/integracion/foxpro/lotes/{Uri.EscapeDataString(batchCode)}/bloques", new
            {
                numero_bloque = index + 1, total_bloques = blocks, hash_bloque = Hash(records), registros = records
            });
            progress(index + 1, blocks);
        }
        var finalResponse = await PostWithRetry($"api/integracion/foxpro/lotes/{Uri.EscapeDataString(batchCode)}/finalizar", new { });
        using var document = JsonDocument.Parse(finalResponse);
        var totals = document.RootElement.GetProperty("lot").GetProperty("totals");
        var rejected = totals.GetProperty("ERROR").GetInt32() + totals.GetProperty("CONFLICTO").GetInt32();
        return new SendResult(blocks, rejected);
    }

    private async Task<string> PostWithRetry(string path, object body)
    {
        Exception? last = null;
        for (var attempt = 1; attempt <= Math.Max(1, _config.Importacion.MaxRetries); attempt++)
        {
            try
            {
                using var content = new StringContent(JsonSerializer.Serialize(body, JsonOptions), Encoding.UTF8, "application/json");
                using var response = await _http.PostAsync(path, content);
                var responseText = await response.Content.ReadAsStringAsync();
                if (!response.IsSuccessStatusCode) throw new InvalidOperationException($"Control Aguas respondio {(int)response.StatusCode}: {responseText}");
                return responseText;
            }
            catch (Exception error) when (attempt < _config.Importacion.MaxRetries)
            {
                last = error;
                await Task.Delay(TimeSpan.FromSeconds(attempt * 2));
            }
        }
        throw last ?? new InvalidOperationException("No fue posible enviar la informacion.");
    }

    private static string Hash(IEnumerable<FoxProRow> records)
    {
        var rows = records.Select(row => string.Join('\u001f', new[]
        {
            row.Catastral.Trim(), row.Abonado.Trim(), row.Inquilino.Trim(), row.Colonia.Trim(), row.Agua.Trim(),
            row.Alcantarillado.Trim(), row.Barrido.Trim(), row.TrenAseo.Trim(), row.Bombeo.Trim(),
            row.Valor.ToString("G29", CultureInfo.InvariantCulture), row.Intereses.ToString("G29", CultureInfo.InvariantCulture)
        }));
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(string.Join('\u001e', rows)))).ToLowerInvariant();
    }

    public void Dispose() => _http.Dispose();
}
