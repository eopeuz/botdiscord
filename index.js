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

client.once("ready", async () => {
    console.log(`🤖 Bot online como ${client.user.tag}`);

    const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

    for (const guild of client.guilds.cache.values()) {
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, guild.id),
            { body: commands }
        );
        console.log(`✅ Slash registrados em ${guild.name}`);
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

client.on("interactionCreate", async (i) => {
    try {
        if (i.isButton()) {
            const s = paginationStates.get(i.message.id);
            if (!s || i.user.id !== s.userId)
                return i.reply({ content: "❌ Não autorizado.", ephemeral: true });

            s.page += i.customId === "next" ? 1 : -1;
            const { embed } = gerarInventarioEmbed(s.page);
            return i.update({ embeds: [embed], components: [criarRow(s.page, s.totalPages)] });
        }

        if (!i.isChatInputCommand()) return;

        if (i.commandName === "add") {
            inventario.push({
                nome: i.options.getString("nome"),
                quantidade: i.options.getInteger("quantidade"),
                comprador: i.options.getString("comprador"),
                valor_total: i.options.getNumber("valor"),
                registrado_id: i.user.id
            });
            salvarInventario();
            return i.reply({ content: "✔️ Item adicionado!", ephemeral: true });
        }

        if (i.commandName === "listar") {
            const { embed, totalPages } = gerarInventarioEmbed();
            const msg = await i.reply({
                embeds: [embed],
                components: [criarRow(0, totalPages)],
                ephemeral: true,
                fetchReply: true
            });

            paginationStates.set(msg.id, {
                page: 0,
                totalPages,
                userId: i.user.id
            });
        }

        if (i.commandName === "remove") {
            inventario.splice(i.options.getInteger("id") - 1, 1);
            salvarInventario();
            return i.reply({ content: "🗑️ Removido.", ephemeral: true });
        }

        if (i.commandName === "zerar") {
            inventario = [];
            salvarInventario();
            return i.reply({ content: "🧹 Inventário zerado.", ephemeral: true });
        }

        if (i.commandName === "chave") {
            chaves[i.user.id] = i.options.getString("numero");
            salvarChaves();
            return i.reply({ content: "🔑 Chave registrada.", ephemeral: true });
        }

        if (i.commandName === "removerchaveusuario") {
            delete chaves[i.options.getUser("usuario").id];
            salvarChaves();
            return i.reply({ content: "🔑 Chave removida.", ephemeral: true });
        }

    } catch (e) {
        console.error(e);
        return i.reply({ content: "❌ Erro interno.", ephemeral: true });
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
