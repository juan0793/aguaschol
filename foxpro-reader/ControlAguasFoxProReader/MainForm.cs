using System.Data.OleDb;
using System.Diagnostics;
using System.Text.Json;

namespace ControlAguasFoxProReader;

internal sealed class MainForm : Form
{
    private readonly Dictionary<string, Label> _values = new();
    private readonly TextBox _dataPath = new() { Dock = DockStyle.Fill };
    private readonly TextBox _backendUrl = new() { Dock = DockStyle.Fill };
    private readonly TextBox _apiKey = new() { Dock = DockStyle.Fill, UseSystemPasswordChar = true };
    private readonly TextBox _errors = new() { Multiline = true, ReadOnly = true, ScrollBars = ScrollBars.Vertical, Dock = DockStyle.Fill };
    private readonly Button _browse = new() { Text = "Elegir carpeta...", AutoSize = true };
    private readonly Button _test = new() { Text = "1. Probar conexiones", AutoSize = true };
    private readonly Button _send = new() { Text = "2. Enviar paquete ahora", AutoSize = true };
    private readonly Button _logs = new() { Text = "Abrir logs", AutoSize = true };
    private readonly string _configPath = Path.Combine(AppContext.BaseDirectory, "appsettings.json");
    private readonly string _logDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "ControlAguasFoxProReader", "logs");

    internal MainForm()
    {
        Text = "Control Aguas - Lector FoxPro";
        Width = 920; Height = 780; MinimumSize = new Size(780, 650); StartPosition = FormStartPosition.CenterScreen;
        Font = new Font("Segoe UI", 9F); BackColor = Color.FromArgb(244, 248, 252);
        Directory.CreateDirectory(_logDir);

        var title = new Label { Text = "Enviar padron desde FoxPro", Font = new Font("Segoe UI", 18F, FontStyle.Bold), AutoSize = true };
        var note = new Label { Text = "Proceso manual y de solo lectura. Nada se envia hasta pulsar el boton.", AutoSize = true, ForeColor = Color.FromArgb(22, 112, 75) };
        var config = BuildConfigPanel();
        var status = new TableLayoutPanel { AutoSize = true, ColumnCount = 2, Dock = DockStyle.Top, Padding = new Padding(0, 12, 0, 12) };
        status.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 230)); status.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        foreach (var item in new[] { "Modo FoxPro", "Registros encontrados", "Registros enviados", "Bloques enviados", "Registros rechazados", "Codigo del lote", "Conexion Control Aguas", "Fecha y hora" }) AddStatus(status, item);

        var actions = new FlowLayoutPanel { AutoSize = true, Dock = DockStyle.Top, FlowDirection = FlowDirection.LeftToRight, Padding = new Padding(0, 8, 0, 8) };
        actions.Controls.AddRange(new Control[] { _test, _send, _logs });
        var errorLabel = new Label { Text = "Actividad", Font = new Font("Segoe UI", 10F, FontStyle.Bold), AutoSize = true };
        var root = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(24), RowCount = 7, ColumnCount = 1 };
        for (var row = 0; row < 6; row++) root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        root.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        root.Controls.Add(title); root.Controls.Add(note); root.Controls.Add(config); root.Controls.Add(status); root.Controls.Add(actions); root.Controls.Add(errorLabel); root.Controls.Add(_errors);
        Controls.Add(root);

        _browse.Click += (_, _) => ChooseFolder();
        _test.Click += async (_, _) => await TestConnection();
        _send.Click += async (_, _) => await Send();
        _logs.Click += (_, _) => Process.Start(new ProcessStartInfo("explorer.exe", _logDir) { UseShellExecute = true });
        Shown += (_, _) => ShowConfig();
    }

    private TableLayoutPanel BuildConfigPanel()
    {
        var panel = new TableLayoutPanel { AutoSize = true, ColumnCount = 3, Dock = DockStyle.Top, Padding = new Padding(0, 16, 0, 4) };
        panel.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 180)); panel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100)); panel.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
        AddConfigRow(panel, "Carpeta de datos FoxPro", _dataPath, _browse);
        AddConfigRow(panel, "Servidor Control Aguas", _backendUrl);
        AddConfigRow(panel, "Clave de integracion", _apiKey);
        return panel;
    }

    private static void AddConfigRow(TableLayoutPanel panel, string label, Control input, Control? action = null)
    {
        panel.Controls.Add(new Label { Text = label, AutoSize = true, Font = new Font("Segoe UI", 9F, FontStyle.Bold), Margin = new Padding(0, 7, 12, 7) });
        input.Margin = new Padding(0, 3, 8, 3); panel.Controls.Add(input);
        panel.Controls.Add(action ?? new Label());
    }

    private void AddStatus(TableLayoutPanel panel, string key)
    {
        var label = new Label { Text = key, AutoSize = true, Font = new Font("Segoe UI", 9F, FontStyle.Bold), Margin = new Padding(0, 5, 12, 5) };
        var value = new Label { Text = "--", AutoSize = true, Margin = new Padding(0, 5, 0, 5) };
        _values[key] = value; panel.Controls.Add(label); panel.Controls.Add(value);
    }

    private ReaderConfig LoadConfig()
    {
        if (!File.Exists(_configPath)) return new ReaderConfig();
        return JsonSerializer.Deserialize<ReaderConfig>(File.ReadAllText(_configPath), new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new ReaderConfig();
    }

    private ReaderConfig SaveConfig()
    {
        var config = new ReaderConfig
        {
            FoxPro = new FoxProConfig { DataPath = _dataPath.Text.Trim(), TableName = "maestro" },
            ControlAguas = new ControlAguasConfig { ApiUrl = _backendUrl.Text.Trim(), ApiKey = _apiKey.Text.Trim() }
        };
        if (!Directory.Exists(config.FoxPro.DataPath)) throw new DirectoryNotFoundException("Selecciona la carpeta que contiene maestro.dbf.");
        if (!Uri.TryCreate(config.ControlAguas.ApiUrl, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps) throw new InvalidOperationException("La URL de Control Aguas debe iniciar con https://");
        if (string.IsNullOrWhiteSpace(config.ControlAguas.ApiKey)) throw new InvalidOperationException("Pega la clave de integracion proporcionada por el administrador.");
        File.WriteAllText(_configPath, JsonSerializer.Serialize(config, new JsonSerializerOptions { WriteIndented = true }));
        return config;
    }

    private void ShowConfig()
    {
        try
        {
            var config = LoadConfig();
            _dataPath.Text = config.FoxPro.DataPath; _backendUrl.Text = config.ControlAguas.ApiUrl; _apiKey.Text = config.ControlAguas.ApiKey;
            Set("Modo FoxPro", "Solo lectura");
        }
        catch (Exception error) { Report(error); }
    }

    private void ChooseFolder()
    {
        using var dialog = new FolderBrowserDialog { Description = "Selecciona la carpeta que contiene maestro.dbf", ShowNewFolderButton = false, SelectedPath = _dataPath.Text };
        if (dialog.ShowDialog(this) == DialogResult.OK) _dataPath.Text = dialog.SelectedPath;
    }

    private async Task TestConnection()
    {
        await Busy(async () =>
        {
            var config = SaveConfig();
            var count = await Task.Run(() => FoxProReader.Test(config));
            using var client = new ControlAguasClient(config); await client.TestAsync();
            Set("Registros encontrados", count.ToString("N0")); Set("Modo FoxPro", "Solo lectura confirmada"); Set("Conexion Control Aguas", "Correcta");
            Report($"Todo listo. {count:N0} registros disponibles.");
        });
    }

    private async Task Send()
    {
        await Busy(async () =>
        {
            var config = SaveConfig();
            Set("Conexion Control Aguas", "Enviando"); Set("Fecha y hora", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
            var rows = await Task.Run(() => FoxProReader.ReadAll(config));
            var code = $"FOXPRO-{DateTime.Now:yyyyMMdd-HHmmss}-{Guid.NewGuid().ToString("N")[..8]}";
            Set("Registros encontrados", rows.Count.ToString("N0")); Set("Codigo del lote", code);
            using var client = new ControlAguasClient(config);
            var result = await client.SendAsync(rows, code, DateTime.Now, (sent, total) => BeginInvoke(new Action(() =>
            {
                Set("Bloques enviados", $"{sent:N0} / {total:N0}");
                Set("Registros enviados", Math.Min(sent * config.Importacion.BatchSize, rows.Count).ToString("N0"));
            })));
            Set("Conexion Control Aguas", "Paquete recibido"); Set("Registros rechazados", result.Rejected.ToString("N0"));
            Report($"Paquete {code} enviado. Ya puede revisarse en Control Aguas > Importacion.");
        });
    }

    private async Task Busy(Func<Task> action)
    {
        _test.Enabled = _send.Enabled = false;
        try { await action(); }
        catch (OleDbException error) when (error.Message.Contains("provider", StringComparison.OrdinalIgnoreCase)) { Report(new InvalidOperationException("VFPOLEDB.1 no esta instalado o no es de 32 bits.", error)); }
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
