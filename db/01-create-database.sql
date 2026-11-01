-- Chạy trên database master: tạo CSDL DubchefDB nếu chưa có.
IF DB_ID(N'DubchefDB') IS NULL
    CREATE DATABASE DubchefDB;
GO
