using System.Data;
using System.Data.OleDb;
using System.Globalization;

namespace ControlAguasFoxProReader;

internal static class FoxProReader
{
    private static readonly HashSet<string> AllowedTables = new(StringComparer.OrdinalIgnoreCase) { "maestro" };
    private static readonly string[] GroupFields = { "catastral", "abonado", "inquilino", "agua", "alca", "barr", "tren", "bomb" };
    private static readonly string[] ValueFields = { "sdo_agua", "sdo_alca", "sdo_barr", "sdo_tren", "sdo_cemt", "sdo_bomb", "sdo_cagu", "sdo_otro" };
    private static readonly string[] InterestFields = { "int_agua", "int_alca", "int_barr", "int_tren" };

    private static string ConnectionString(string path) =>
        $"Provider=VFPOLEDB.1;Data Source={path};Mode=Read;Collating Sequence=machine;";

    private static string Validate(ReaderConfig config)
    {
        if (!Directory.Exists(config.FoxPro.DataPath)) throw new DirectoryNotFoundException($"No existe la ruta {config.FoxPro.DataPath}.");
        if (!AllowedTables.Contains(config.FoxPro.TableName)) throw new InvalidOperationException("La tabla no esta permitida.");
        return config.FoxPro.TableName;
    }

    internal static int Test(ReaderConfig config) => ReadAll(config).Count;

    internal static List<FoxProRow> ReadAll(ReaderConfig config)
    {
        var table = Validate(config);
        using var connection = new OleDbConnection(ConnectionString(config.FoxPro.DataPath));
        connection.Open();
        var available = AvailableColumns(connection, table);
        var groups = GroupFields.Select(field => Quote(RequiredColumn(available, field))).ToArray();
        var colony = Quote(RequiredColony(available, config));
        var values = ValueFields.Select(field => Quote(RequiredColumn(available, field))).ToArray();
        var interests = InterestFields.Select(field => Quote(RequiredColumn(available, field))).ToArray();
        var select = string.Join(", ", groups.Take(3).Concat(new[] { colony }).Concat(groups.Skip(3)).Concat(values).Concat(interests));

        using var command = new OleDbCommand($"SELECT {select} FROM {table}", connection);
        using var reader = command.ExecuteReader();
        var rows = new Dictionary<string, FoxProRow>();
        while (reader != null && reader.Read())
        {
            var fields = Enumerable.Range(0, 9).Select(index => Value(reader, index)).ToArray();
            var key = string.Join('\u001f', fields);
            if (!rows.TryGetValue(key, out var row))
            {
                row = new FoxProRow
                {
                    NumeroFila = rows.Count + 1,
                    Catastral = fields[0], Abonado = fields[1], Inquilino = fields[2], Colonia = fields[3],
                    Agua = fields[4], Alcantarillado = fields[5], Barrido = fields[6], TrenAseo = fields[7], Bombeo = fields[8]
                };
                rows.Add(key, row);
            }
            row.Valor += Enumerable.Range(9, values.Length).Sum(index => Amount(reader, index));
            row.Intereses += Enumerable.Range(9 + values.Length, interests.Length).Sum(index => Amount(reader, index));
        }
        return rows.Values.ToList();
    }

    private static string[] AvailableColumns(OleDbConnection connection, string table)
    {
        using var command = new OleDbCommand($"SELECT * FROM {table}", connection);
        using var reader = command.ExecuteReader(CommandBehavior.SchemaOnly) ?? throw new InvalidOperationException("No fue posible leer la estructura de maestro.dbf.");
        return Enumerable.Range(0, reader.FieldCount).Select(reader.GetName).ToArray();
    }

    private static string RequiredColumn(string[] available, string expected) =>
        available.FirstOrDefault(name => name.Equals(expected, StringComparison.OrdinalIgnoreCase))
        ?? throw new InvalidOperationException($"No se encontro la columna {expected}. Columnas disponibles: {string.Join(", ", available)}");

    private static string RequiredColony(string[] available, ReaderConfig config) =>
        available.FirstOrDefault(name => name.Equals("des_coloni", StringComparison.OrdinalIgnoreCase))
        ?? throw new InvalidOperationException($"El maestro.dbf seleccionado no contiene des_coloni y no corresponde al archivo verificado. Ruta: {Path.Combine(config.FoxPro.DataPath, "maestro.dbf")}. Columnas disponibles: {string.Join(", ", available)}");

    private static string Quote(string name) => $"[{name.Replace("]", "]]" )}]";
    private static string Value(OleDbDataReader reader, int index) => reader.IsDBNull(index) ? "" : Convert.ToString(reader.GetValue(index))?.Trim() ?? "";
    private static decimal Amount(OleDbDataReader reader, int index)
    {
        if (reader.IsDBNull(index)) return 0;
        var value = reader.GetValue(index);
        if (value is not string text) return Convert.ToDecimal(value, CultureInfo.InvariantCulture);
        text = text.Trim();
        if (text.Length == 0) return 0;
        return decimal.TryParse(text, NumberStyles.Any, CultureInfo.InvariantCulture, out var amount)
            ? amount
            : throw new InvalidOperationException($"El campo {reader.GetName(index)} contiene un valor no numerico: {text}.");
    }
}
