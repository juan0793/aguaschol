using System.Data;
using System.Data.OleDb;

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
        var groups = GroupFields.Select(field => Quote(RequiredColumn(available, field).Name)).ToArray();
        var colony = Quote(RequiredColony(available, config).Name);
        var values = ValueFields.Select(field => NumericExpression(RequiredColumn(available, field)));
        var interests = InterestFields.Select(field => NumericExpression(RequiredColumn(available, field)));
        var select = string.Join(", ", groups.Take(3).Concat(new[] { colony }).Concat(groups.Skip(3)))
            + $", SUM({string.Join("+", values)}) AS valor, SUM({string.Join("+", interests)}) AS intereses";
        var groupBy = string.Join(", ", groups.Concat(new[] { colony }));

        using var command = new OleDbCommand($"SELECT {select} FROM {table} GROUP BY {groupBy}", connection);
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

    private static (string Name, Type Type)[] AvailableColumns(OleDbConnection connection, string table)
    {
        using var command = new OleDbCommand($"SELECT * FROM {table}", connection);
        using var reader = command.ExecuteReader(CommandBehavior.SchemaOnly) ?? throw new InvalidOperationException("No fue posible leer la estructura de maestro.dbf.");
        return Enumerable.Range(0, reader.FieldCount).Select(index => (reader.GetName(index), reader.GetFieldType(index))).ToArray();
    }

    private static (string Name, Type Type) RequiredColumn((string Name, Type Type)[] available, string expected) =>
        available.FirstOrDefault(column => column.Name.Equals(expected, StringComparison.OrdinalIgnoreCase)) is var column && column.Name != null
            ? column
            : throw new InvalidOperationException($"No se encontro la columna {expected}. Columnas disponibles: {string.Join(", ", available.Select(item => item.Name))}");

    private static (string Name, Type Type) RequiredColony((string Name, Type Type)[] available, ReaderConfig config) =>
        available.FirstOrDefault(column => column.Name.Equals("des_coloni", StringComparison.OrdinalIgnoreCase)) is var column && column.Name != null
            ? column
            : throw new InvalidOperationException($"El maestro.dbf seleccionado no contiene des_coloni y no corresponde al archivo verificado. Ruta: {Path.Combine(config.FoxPro.DataPath, "maestro.dbf")}. Columnas disponibles: {string.Join(", ", available.Select(item => item.Name))}");

    private static string NumericExpression((string Name, Type Type) column) => column.Type == typeof(string)
        ? $"VAL(NVL(ALLTRIM({Quote(column.Name)}), '0'))"
        : $"NVL({Quote(column.Name)}, 0)";
    private static string Quote(string name) => $"[{name.Replace("]", "]]" )}]";
    private static string Value(OleDbDataReader reader, int index) => reader.IsDBNull(index) ? "" : Convert.ToString(reader.GetValue(index))?.Trim() ?? "";
    private static decimal Amount(OleDbDataReader reader, int index) => reader.IsDBNull(index) ? 0 : Convert.ToDecimal(reader.GetValue(index));
}
