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

# As bases e os baldes guardam os dados de quem usa a app — e o deploy aplica
# este ficheiro contra a conta de produção. Levam prevent_destroy: um apply que
# os quisesse destruir ou substituir (um name mudado, um atributo que uma
# versão nova do provider passe a tratar como substituição) rebenta no plano em
# vez de apagar a base e criá-la vazia. O deploy recusa ainda qualquer plano com
# destruições (passo «Terraform» do deploy.yml). Para destruir de propósito:
# tirar o prevent_destroy num commit e correr o Deploy à mão com o endereço em
# «aceitar_destruicao». As sessões (KV) não o levam: perdê-las é toda a gente a
# entrar outra vez, não dados perdidos — e o plano recusa-as na mesma.

# Base de dados D1 (SQLite gerido, plano gratuito: 5 GB / 5M leituras por dia).
resource "cloudflare_d1_database" "db" {
  account_id = var.cloudflare_account_id
  name       = var.app_name

  # sem isto o provider tenta enviar null no segundo apply e a API rejeita
  read_replication = {
    mode = "disabled"
  }

  lifecycle {
    prevent_destroy = true
  }
}

# KV para sessões de utilizadores (plano gratuito: 100k leituras por dia).
resource "cloudflare_workers_kv_namespace" "sessions" {
  account_id = var.cloudflare_account_id
  title      = "${var.app_name}-sessions"
}

# Anexos: fotos e documentos. Plano gratuito: 10 GB, sem custo de saída.
resource "cloudflare_r2_bucket" "files" {
  account_id = var.cloudflare_account_id
  name       = var.app_name

  # os anexos e as cópias diárias da base vivem aqui
  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_r2_bucket" "files_dev" {
  account_id = var.cloudflare_account_id
  name       = "${var.app_name}-dev"

  lifecycle {
    prevent_destroy = true
  }
}

# Ambiente de desenvolvimento: base e sessões próprias, para se poder testar
# migrações e alterações sem tocar nos dados de quem usa a app a sério.
resource "cloudflare_d1_database" "db_dev" {
  account_id = var.cloudflare_account_id
  name       = "${var.app_name}-dev"

  read_replication = {
    mode = "disabled"
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_workers_kv_namespace" "sessions_dev" {
  account_id = var.cloudflare_account_id
  title      = "${var.app_name}-dev-sessions"
}

output "d1_database_id" {
  value = cloudflare_d1_database.db.id
}

output "kv_sessions_id" {
  value = cloudflare_workers_kv_namespace.sessions.id
}

output "d1_dev_id" {
  value = cloudflare_d1_database.db_dev.id
}

output "kv_dev_id" {
  value = cloudflare_workers_kv_namespace.sessions_dev.id
}
