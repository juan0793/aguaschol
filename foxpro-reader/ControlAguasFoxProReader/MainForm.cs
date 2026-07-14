using System.Diagnostics;
using System.Data.OleDb;
using System.Text.Json;

namespace ControlAguasFoxProReader;

internal sealed class MainForm : Form
{
    private readonly Dictionary<string, Label> _values = new();
    private readonly TextBox _errors = new() { Multiline = true, ReadOnly = true, ScrollBars = ScrollBars.Vertical, Dock = DockStyle.Fill };
    private readonly Button _test = new() { Text = "Probar conexion", AutoSize = true };
    private readonly Button _send = new() { Text = "Enviar informacion a Control Aguas", AutoSize = true };
    private readonly Button _logs = new() { Text = "Abrir carpeta de logs", AutoSize = true };
    private readonly string _logDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "ControlAguasFoxProReader", "logs");

    internal MainForm()
    {
        Text = "Control Aguas - Lector FoxPro";
        Width = 900; Height = 680; MinimumSize = new Size(760, 560); StartPosition = FormStartPosition.CenterScreen;
        Font = new Font("Segoe UI", 9F); BackColor = Color.FromArgb(244, 248, 252);
        Directory.CreateDirectory(_logDir);

        var title = new Label { Text = "Importacion manual desde FoxPro", Font = new Font("Segoe UI", 18F, FontStyle.Bold), AutoSize = true };
        var note = new Label { Text = "Solo lectura: este programa nunca crea, modifica ni elimina datos en FoxPro.", AutoSize = true, ForeColor = Color.FromArgb(22, 112, 75) };
        var status = new TableLayoutPanel { AutoSize = true, ColumnCount = 2, Dock = DockStyle.Top, Padding = new Padding(0, 12, 0, 12) };
        status.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 230)); status.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        foreach (var item in new[] { "Ruta", "Tabla", "Modo FoxPro", "Registros encontrados", "Registros enviados", "Bloques enviados", "Registros rechazados", "Codigo del lote", "Conexion Control Aguas", "Fecha y hora" }) AddStatus(status, item);

        var actions = new FlowLayoutPanel { AutoSize = true, Dock = DockStyle.Top, FlowDirection = FlowDirection.LeftToRight, Padding = new Padding(0, 8, 0, 8) };
        actions.Controls.AddRange(new Control[] { _test, _send, _logs });
        var errorLabel = new Label { Text = "Errores y actividad", Font = new Font("Segoe UI", 10F, FontStyle.Bold), AutoSize = true };
        var root = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(24), RowCount = 6, ColumnCount = 1 };
        root.RowStyles.Add(new RowStyle(SizeType.AutoSize)); root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        root.RowStyles.Add(new RowStyle(SizeType.AutoSize)); root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        root.RowStyles.Add(new RowStyle(SizeType.AutoSize)); root.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        root.Controls.Add(title); root.Controls.Add(note); root.Controls.Add(status); root.Controls.Add(actions); root.Controls.Add(errorLabel); root.Controls.Add(_errors);
        Controls.Add(root);

        _test.Click += async (_, _) => await TestConnection();
        _send.Click += async (_, _) => await Send();
        _logs.Click += (_, _) => Process.Start(new ProcessStartInfo("explorer.exe", _logDir) { UseShellExecute = true });
        Shown += (_, _) => ShowConfig();
    }

    private void AddStatus(TableLayoutPanel panel, string key)
    {
        var label = new Label { Text = key, AutoSize = true, Font = new Font("Segoe UI", 9F, FontStyle.Bold), Margin = new Padding(0, 5, 12, 5) };
        var value = new Label { Text = "--", AutoSize = true, Margin = new Padding(0, 5, 0, 5) };
        _values[key] = value; panel.Controls.Add(label); panel.Controls.Add(value);
    }

    private ReaderConfig LoadConfig(bool requireApiKey = false)
    {
        var path = Path.Combine(AppContext.BaseDirectory, "appsettings.json");
        if (!File.Exists(path)) throw new FileNotFoundException("Copia appsettings.example.json como appsettings.json y completa la configuracion.");
        var config = JsonSerializer.Deserialize<ReaderConfig>(File.ReadAllText(path), new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? throw new InvalidOperationException("Configuracion invalida.");
        if (requireApiKey && (string.IsNullOrWhiteSpace(config.ControlAguas.ApiUrl) || string.IsNullOrWhiteSpace(config.ControlAguas.ApiKey))) throw new InvalidOperationException("Falta ApiUrl o ApiKey de Control Aguas.");
        return config;
    }

    private void ShowConfig()
    {
        try { var config = LoadConfig(); Set("Ruta", config.FoxPro.DataPath); Set("Tabla", config.FoxPro.TableName); Set("Modo FoxPro", "Solo lectura"); }
        catch (Exception error) { Report(error); }
    }

    private async Task TestConnection()
    {
        await Busy(async () =>
        {
            var config = LoadConfig();
            var count = await Task.Run(() => FoxProReader.Test(config));
            Set("Registros encontrados", count.ToString("N0")); Set("Modo FoxPro", "Solo lectura confirmada");
            Report($"Conexion correcta. {count:N0} registros disponibles.");
        });
    }

    private async Task Send()
    {
        await Busy(async () =>
        {
            var config = LoadConfig(true);
            Set("Conexion Control Aguas", "Conectando"); Set("Fecha y hora", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
            var rows = await Task.Run(() => FoxProReader.ReadAll(config));
            var code = $"FOXPRO-{DateTime.Now:yyyyMMdd-HHmmss}-{Guid.NewGuid().ToString("N")[..8]}";
            Set("Registros encontrados", rows.Count.ToString("N0")); Set("Codigo del lote", code);
            using var client = new ControlAguasClient(config);
            var result = await client.SendAsync(rows, code, DateTime.Now, (sent, total) => BeginInvoke(new Action(() =>
            {
                Set("Bloques enviados", $"{sent:N0} / {total:N0}");
                Set("Registros enviados", Math.Min(sent * config.Importacion.BatchSize, rows.Count).ToString("N0"));
            })));
            Set("Conexion Control Aguas", "Lote recibido para revision"); Set("Registros rechazados", result.Rejected.ToString("N0"));
            Report($"Lote {code} enviado. Control Aguas no ha modificado el padron; requiere confirmacion manual.");
        });
    }

    private async Task Busy(Func<Task> action)
    {
        _test.Enabled = _send.Enabled = false;
        try { await action(); }
        catch (OleDbException error) when (error.Message.Contains("provider", StringComparison.OrdinalIgnoreCase)) { Report(new InvalidOperationException("VFPOLEDB.1 no esta instalado o la arquitectura no coincide. Instala el proveedor de 32 bits y usa el ejecutable win-x86.", error)); }
        catch (Exception error) { Report(error); }
        finally { _test.Enabled = _send.Enabled = true; }
    }

    private void Set(string key, string value) { if (_values.TryGetValue(key, out var label)) label.Text = value; }
    private void Report(Exception error) => Report($"ERROR: {error.Message}");
    private void Report(string message)
    {
        var line = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {message}";
        _errors.AppendText(line + Environment.NewLine);
        File.AppendAllText(Path.Combine(_logDir, $"lector-{DateTime.Now:yyyyMMdd}.log"), line + Environment.NewLine);
    }
}
