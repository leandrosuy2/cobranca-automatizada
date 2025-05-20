# 💰 Sistema de Cobrança Automatizada

<div align="center">

![NestJS](https://img.shields.io/badge/NestJS-EA2845?style=for-the-badge&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white)
![WhatsApp](https://img.shields.io/badge/WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)
![Mercado Pago](https://img.shields.io/badge/Mercado_Pago-009EE3?style=for-the-badge&logo=mercadopago&logoColor=white)

</div>

## 📋 Descrição

Sistema automatizado de cobrança desenvolvido com NestJS que gerencia o processo de cobrança de parcelas, integrando-se com WhatsApp para notificações e Mercado Pago para processamento de pagamentos via PIX.

### ✨ Principais Funcionalidades

- 🔄 Verificação automática de parcelas vencidas e a vencer
- 💬 Notificações automáticas via WhatsApp
- 💳 Geração de QR Code PIX para pagamento
- 📊 Cálculo automático de juros e multas
- 🔍 Monitoramento em tempo real do status dos pagamentos
- 📝 Registro detalhado de todas as interações
- 🔐 Sistema seguro e confiável

## 🚀 Tecnologias Utilizadas

- **Backend Framework:** NestJS
- **Linguagem:** TypeScript
- **Banco de Dados:** MySQL
- **ORM:** TypeORM
- **Integrações:**
  - WhatsApp Business API (via Evolution API)
  - Mercado Pago API
- **Agendamento de Tarefas:** @nestjs/schedule
- **Gerenciamento de Configurações:** @nestjs/config

## 🛠️ Pré-requisitos

- Node.js (v16 ou superior)
- MySQL (v8.0 ou superior)
- Conta Mercado Pago (com acesso à API)
- Conta WhatsApp Business API (via Evolution API)

## ⚙️ Configuração do Ambiente

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/cobranca-automatizada.git
cd cobranca-automatizada
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
# Configurações do Banco de Dados
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=seu_usuario
DB_PASSWORD=sua_senha
DB_DATABASE=nome_do_banco

# Configurações do Mercado Pago
MP_ACCESS_TOKEN=seu_token_do_mercadopago

# Configurações do WhatsApp
EVOLUTION_API_URL=https://sua-evolution-api.com
EVOLUTION_API_KEY=sua_chave_api
INSTANCE_ID=seu_instance_id

# Configurações da Aplicação
PORT=3000
```

4. Execute as migrações do banco de dados:
```bash
npm run typeorm migration:run
```

## 🚀 Executando o Projeto

### Desenvolvimento
```bash
npm run start:dev
```

### Produção
```bash
npm run build
npm run start:prod
```

## 📦 Estrutura do Projeto

```
src/
├── config/                 # Configurações da aplicação
├── entities/              # Entidades do banco de dados
│   ├── cliente.entity.ts
│   ├── contrato.entity.ts
│   ├── controle-emails.entity.ts
│   └── parcela.entity.ts
├── services/              # Serviços da aplicação
│   ├── mercadopago.service.ts
│   ├── parcel.service.ts
│   └── whatsapp.service.ts
├── tasks/                 # Tarefas agendadas
│   └── parcel-checker.task.ts
└── main.ts               # Ponto de entrada da aplicação
```

## 🔄 Fluxo de Funcionamento

1. **Verificação de Parcelas**
   - O sistema verifica automaticamente as parcelas a cada 30 segundos
   - Identifica parcelas vencidas e a vencer
   - Atualiza o status dos pagamentos existentes

2. **Processamento de Cobrança**
   - Para parcelas vencidas:
     - Calcula juros (0.033% ao dia) e multa (2%)
     - Gera novo QR Code PIX
     - Envia notificação via WhatsApp
   - Para parcelas a vencer:
     - Gera QR Code PIX
     - Envia lembretes via WhatsApp

3. **Monitoramento de Pagamentos**
   - Verifica o status dos pagamentos no Mercado Pago
   - Atualiza o status da parcela quando paga
   - Envia confirmação de pagamento via WhatsApp

## 📊 Banco de Dados

O sistema utiliza as seguintes tabelas principais:

- **clientes**: Informações dos clientes
- **contratos**: Contratos associados aos clientes
- **parcelas**: Parcelas dos contratos
- **controle_emails**: Registro de mensagens enviadas

## 🔒 Segurança

- Autenticação via tokens para APIs externas
- Validação de dados em todas as operações
- Logs detalhados para auditoria
- Tratamento seguro de informações sensíveis

## 🤝 Contribuindo

1. Faça um Fork do projeto
2. Crie uma Branch para sua Feature (`git checkout -b feature/AmazingFeature`)
3. Faça o Commit das suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Faça o Push para a Branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 📞 Suporte

Para suporte, envie um email para seu-email@dominio.com ou abra uma issue no repositório.

---

<div align="center">
  <sub>Desenvolvido com ❤️ por Seu Nome</sub>
</div>
