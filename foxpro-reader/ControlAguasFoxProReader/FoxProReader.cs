using System.Data.OleDb;
using System.Data;

namespace ControlAguasFoxProReader;

internal static class FoxProReader
{
    private static readonly HashSet<string> AllowedTables = new(StringComparer.OrdinalIgnoreCase) { "maestro" };
    private static readonly string[][] ColumnAliases =
    {
        new[] { "catastral" }, new[] { "abonado" }, new[] { "inquilino" },
        new[] { "des_coloni", "des_colon", "des_col", "colonia" },
        new[] { "agua" }, new[] { "alca" }, new[] { "barr" }, new[] { "tren" },
        new[] { "bomb" }, new[] { "valor" }, new[] { "intereses" }
    };

    private static string ConnectionString(string path) =>
        $"Provider=VFPOLEDB.1;Data Source={path};Mode=Read;Collating Sequence=machine;";

    private static string Validate(ReaderConfig config)
    {
        if (!Directory.Exists(config.FoxPro.DataPath)) throw new DirectoryNotFoundException($"No existe la ruta {config.FoxPro.DataPath}.");
        if (!AllowedTables.Contains(config.FoxPro.TableName)) throw new InvalidOperationException("La tabla no esta permitida.");
        return config.FoxPro.TableName;
    }

    internal static int Test(ReaderConfig config)
    {
        var table = Validate(config);
        using var connection = new OleDbConnection(ConnectionString(config.FoxPro.DataPath));
        connection.Open();
        using var command = new OleDbCommand($"SELECT COUNT(*) FROM {table}", connection);
        return Convert.ToInt32(command.ExecuteScalar());
    }

    internal static List<FoxProRow> ReadAll(ReaderConfig config)
    {
        var table = Validate(config);
        using var connection = new OleDbConnection(ConnectionString(config.FoxPro.DataPath));
        connection.Open();
        var columns = ResolveColumns(connection, table);
        using var command = new OleDbCommand($"SELECT {string.Join(", ", columns.Select(name => $"[{name.Replace("]", "]]" )}]"))} FROM {table}", connection);
        using var reader = command.ExecuteReader();
        var rows = new List<FoxProRow>();
        while (reader != null && reader.Read())
        {
            rows.Add(new FoxProRow
            {
                NumeroFila = rows.Count + 1,
                Catastral = Value(reader, 0), Abonado = Value(reader, 1), Inquilino = Value(reader, 2), Colonia = Value(reader, 3),
                Agua = Value(reader, 4), Alcantarillado = Value(reader, 5), Barrido = Value(reader, 6), TrenAseo = Value(reader, 7),
                Bombeo = Value(reader, 8), Valor = Amount(reader, 9), Intereses = Amount(reader, 10)
            });
        }
        return rows;
    }

    private static string[] ResolveColumns(OleDbConnection connection, string table)
    {
        using var command = new OleDbCommand($"SELECT * FROM {table}", connection);
        using var reader = command.ExecuteReader(CommandBehavior.SchemaOnly) ?? throw new InvalidOperationException("No fue posible leer la estructura de maestro.dbf.");
        var available = Enumerable.Range(0, reader.FieldCount).Select(reader.GetName).ToArray();
        return ColumnAliases.Select(aliases =>
            aliases.Select(alias => available.FirstOrDefault(name => name.Equals(alias, StringComparison.OrdinalIgnoreCase)))
                .FirstOrDefault(name => name != null)
            ?? (aliases[0] == "des_coloni" ? available.FirstOrDefault(name => name.Contains("COLON", StringComparison.OrdinalIgnoreCase)) : null)
            ?? throw new InvalidOperationException($"No se encontro la columna {aliases[0]}. Columnas disponibles: {string.Join(", ", available)}")
        ).ToArray()!;
    }

    private static string Value(OleDbDataReader reader, int index) => reader.IsDBNull(index) ? "" : Convert.ToString(reader.GetValue(index))?.Trim() ?? "";
    private static decimal Amount(OleDbDataReader reader, int index) => reader.IsDBNull(index) ? 0 : Convert.ToDecimal(reader.GetValue(index));
}
