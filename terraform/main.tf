terraform {
  required_version = ">= 1.5"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }
}

# O token vem da variável de ambiente CLOUDFLARE_API_TOKEN.
provider "cloudflare" {}

variable "cloudflare_account_id" {
  type        = string
  description = "ID da conta Cloudflare (visível no dashboard, em Workers & Pages)."
}

variable "app_name" {
  type    = string
  default = "gestor-imobiliario"
}

# Base de dados D1 (SQLite gerido, plano gratuito: 5 GB / 5M leituras por dia).
resource "cloudflare_d1_database" "db" {
  account_id = var.cloudflare_account_id
  name       = var.app_name
}

# KV para sessões de utilizadores (plano gratuito: 100k leituras por dia).
resource "cloudflare_workers_kv_namespace" "sessions" {
  account_id = var.cloudflare_account_id
  title      = "${var.app_name}-sessions"
}

output "d1_database_id" {
  value = cloudflare_d1_database.db.id
}

output "kv_sessions_id" {
  value = cloudflare_workers_kv_namespace.sessions.id
}
