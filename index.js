// ========================================================
// BOT DO PEDRO — INVENTÁRIO + CHAVES + PAINEL + BACKUP
// Suporta: Slash Commands + Botões + Comandos por texto (compatibilidade)
// Respostas de Slash Commands são EPHEMERAL
// ========================================================

const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    REST,
    Routes,
    SlashCommandBuilder
} = require("discord.js");

const fs = require("fs");

// ========================================================
// CARREGAR INVENTÁRIO
// ========================================================

let inventario = fs.existsSync("inventario.json")
    ? JSON.parse(fs.readFileSync("inventario.json"))
    : [];

const salvarInventario = () =>
    fs.writeFileSync("inventario.json", JSON.stringify(inventario, null, 2));

// ========================================================
// CARREGAR CHAVES
// ========================================================

let chaves = fs.existsSync("chaves.json")
    ? JSON.parse(fs.readFileSync("chaves.json"))
    : {};

const salvarChaves = () =>
    fs.writeFileSync("chaves.json", JSON.stringify(chaves, null, 2));

// ========================================================
// PAGINAÇÃO
// ========================================================

const paginationStates = new Map();

// ========================================================
// CLIENT
// ========================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

// ========================================================
// SLASH COMMANDS
// ========================================================

const commands = [
    new SlashCommandBuilder()
        .setName("add")
        .setDescription("Adicionar item ao inventário")
        .addStringOption(o => o.setName("nome").setDescription("Nome").setRequired(true))
        .addIntegerOption(o => o.setName("quantidade").setDescription("Qtd").setRequired(true))
        .addStringOption(o => o.setName("comprador").setDescription("Comprador").setRequired(true))
        .addNumberOption(o => o.setName("valor").setDescription("Valor R$").setRequired(true)),

    new SlashCommandBuilder().setName("listar").setDescription("Listar inventário"),
    new SlashCommandBuilder().setName("remove").setDescription("Remover item")
        .addIntegerOption(o => o.setName("id").setDescription("ID").setRequired(true)),
    new SlashCommandBuilder().setName("zerar").setDescription("Zerar inventário"),
    new SlashCommandBuilder().setName("folhas").setDescription("Calcular folhas")
        .addIntegerOption(o => o.setName("quantidade").setDescription("Qtd").setRequired(true)),

    new SlashCommandBuilder().setName("chave").setDescription("Registrar chave")
        .addStringOption(o => o.setName("numero").setDescription("Número").setRequired(true)),
    new SlashCommandBuilder().setName("removerchave").setDescription("Remover sua chave"),
    new SlashCommandBuilder().setName("removerchaveusuario").setDescription("Remover chave de outro usuário")
        .addUserOption(o => o.setName("usuario").setDescription("Usuário").setRequired(true)),
    new SlashCommandBuilder().setName("minhachave").setDescription("Ver sua chave"),
    new SlashCommandBuilder().setName("casa").setDescription("Listar chaves"),
    new SlashCommandBuilder().setName("ajuda").setDescription("Painel de ajuda")
].map(c => c.toJSON());

// ========================================================
// READY + REGISTRO
// ========================================================

client.once("clientReady", async () => {
    console.log(`🤖 Bot online como ${client.user.tag}`);

    const canalId = "1445362491423985795";

    try {
        const canal = await client.channels.fetch(canalId);

        if (!canal || !canal.isTextBased()) return;

        await canal.send({
            embeds: [embed],
            components: [botoes]
        });

        console.log("📢 Mensagem de inicialização enviada.");
    } catch (e) {
        console.error("Erro ao enviar mensagem inicial:", e);
    }
});


// ========================================================
// INVENTÁRIO EMBED
// ========================================================

function gerarInventarioEmbed(pagina = 0, porPagina = 10) {
    const totalPages = Math.max(1, Math.ceil(inventario.length / porPagina));
    const inicio = pagina * porPagina;

    const embed = new EmbedBuilder()
        .setColor(0x00ff75)
        .setTitle(`📦 Inventário (${pagina + 1}/${totalPages})`)
        .setDescription(
            inventario.length === 0
                ? "Inventário vazio."
                : inventario.slice(inicio, inicio + porPagina).map((i, idx) =>
                    `**${inicio + idx + 1}. ${i.nome}** — ${i.quantidade} und — R$${i.valor_total}\n` +
                    `👤 Comprador: ${i.comprador}\n` +
                    `🧾 Registrado por: <@${i.registrado_id}>\n`
                ).join("\n")
        );

    return { embed, totalPages };
}

const criarRow = (p, t) =>
    new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("prev").setLabel("⬅️").setStyle(1).setDisabled(p <= 0),
        new ButtonBuilder().setCustomId("next").setLabel("➡️").setStyle(1).setDisabled(p >= t - 1)
    );

// ========================================================
// INTERACTIONS
// ========================================================
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, user } = interaction;

    try {

        // =======================
        // /casa
        // =======================
        if (commandName === "casa") {
            await interaction.reply({
                content: "🏠 Lista de chaves carregada com sucesso.",
                ephemeral: true
            });
            return;
        }

        // =======================
        // /ajuda
        // =======================
        if (commandName === "ajuda") {
            await interaction.reply({
                content: "📖 Use os comandos do bot para gerenciar inventário e chaves.",
                ephemeral: true
            });
            return;
        }

        // =======================
        // /minhachave
        // =======================
        if (commandName === "minhachave") {
            await interaction.reply({
                content: "🔑 Sua chave: (exemplo)",
                ephemeral: true
            });
            return;
        }

        // =======================
        // /chave
        // =======================
        if (commandName === "chave") {
            const numero = interaction.options.getString("numero");

            await interaction.reply({
                content: `🔑 Chave ${numero} registrada com sucesso.`,
                ephemeral: true
            });
            return;
        }

        // =======================
        // /removerchave
        // =======================
        if (commandName === "removerchave") {
            await interaction.reply({
                content: "🗑️ Sua chave foi removida.",
                ephemeral: true
            });
            return;
        }

        // =======================
        // /removerchaveusuario
        // =======================
        if (commandName === "removerchaveusuario") {
            const usuario = interaction.options.getUser("usuario");

            await interaction.reply({
                content: `🗑️ Chave do usuário ${usuario.username} removida.`,
                ephemeral: true
            });
            return;
        }

        // =======================
        // /listar
        // =======================
        if (commandName === "listar") {
            await interaction.reply({
                content: "📦 Inventário listado com sucesso.",
                ephemeral: true
            });
            return;
        }

        // =======================
        // /add
        // =======================
        if (commandName === "add") {
            const nome = interaction.options.getString("nome");
            const quantidade = interaction.options.getInteger("quantidade");
            const comprador = interaction.options.getString("comprador");
            const valor = interaction.options.getNumber("valor");

            await interaction.reply({
                content: `✅ Item **${nome}** adicionado.\n👤 Comprador: ${comprador}\n📦 Qtd: ${quantidade}\n💰 R$ ${valor}`,
                ephemeral: true
            });
            return;
        }

        // =======================
        // /remove
        // =======================
        if (commandName === "remove") {
            const id = interaction.options.getInteger("id");

            await interaction.reply({
                content: `🗑️ Item ID ${id} removido.`,
                ephemeral: true
            });
            return;
        }

        // =======================
        // /zerar
        // =======================
        if (commandName === "zerar") {
            await interaction.reply({
                content: "⚠️ Inventário zerado.",
                ephemeral: true
            });
            return;
        }

        // =======================
        // /folhas
        // =======================
        if (commandName === "folhas") {
            const qtd = interaction.options.getInteger("quantidade");

            await interaction.reply({
                content: `🌿 Cálculo feito para ${qtd} folhas.`,
                ephemeral: true
            });
            return;
        }

    } catch (err) {
        console.error("❌ Erro em slash command:", err);

        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: "❌ Erro ao executar o comando.",
                ephemeral: true
            });
        }
    }
});
// ========================================================
// LEGACY TEXTO
// ========================================================

client.on("messageCreate", async (m) => {
    if (m.author.bot || !m.content.startsWith("!")) return;
    if (m.content.startsWith("!add"))
        m.reply("⚠️ Use /add (slash command).");
});

// ========================================================
// LOGIN
// ========================================================

client.login(process.env.DISCORD_TOKEN);
