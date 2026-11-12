using System;
var password = args.Length > 0 ? args[0] : "Admin@12345678";
var hash = BCrypt.Net.BCrypt.HashPassword(password, 12);
Console.WriteLine(hash);
