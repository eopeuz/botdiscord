// ========================================================
// BOT DO PEDRO — INVENTÁRIO + CHAVES + PAINEL + BACKUP
// Suporta: Slash Commands + Botões + Comandos por texto (compatibilidade)
// Respostas de Slash Commands são EPHEMERAL (visíveis só para quem chamou)
// ========================================================

const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    PermissionsBitField,
    REST,
    Routes,
    SlashCommandBuilder
} = require("discord.js");

const fs = require("fs");
const config = require("./config.json");

// ========================================================
// CARREGAR INVENTÁRIO
// ========================================================

let inventario = [];
if (fs.existsSync("inventario.json")) {
    inventario = JSON.parse(fs.readFileSync("inventario.json"));
}

function salvarInventario() {
    fs.writeFileSync("inventario.json", JSON.stringify(inventario, null, 2));
}

// ========================================================
// CARREGAR SISTEMA DE CHAVES
// ========================================================

let chaves = {};
if (fs.existsSync("chaves.json")) {
    chaves = JSON.parse(fs.readFileSync("chaves.json"));
}

function salvarChaves() {
    fs.writeFileSync("chaves.json", JSON.stringify(chaves, null, 2));
}

// ========================================================
// CONTROLES DE PAGINAÇÃO (em memória)
// ========================================================

const paginationStates = new Map();

// ========================================================
// INICIAR BOT
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
// COMANDOS PARA REGISTRAR (SLASH)
// ========================================================

const commands = [
    new SlashCommandBuilder()
        .setName("add")
        .setDescription("Adicionar item ao inventário")
        .addStringOption(opt => opt.setName("nome").setDescription("Nome do item").setRequired(true))
        .addIntegerOption(opt => opt.setName("quantidade").setDescription("Quantidade").setRequired(true))
        .addStringOption(opt => opt.setName("comprador").setDescription("Nome do comprador").setRequired(true))
        .addNumberOption(opt => opt.setName("valor").setDescription("Valor total (R$)").setRequired(true)),
    new SlashCommandBuilder()
        .setName("listar")
        .setDescription("Listar inventário (apenas você verá)"),
    new SlashCommandBuilder()
        .setName("remove")
        .setDescription("Remover item do inventário pelo ID")
        .addIntegerOption(opt => opt.setName("id").setDescription("ID do item").setRequired(true)),
    new SlashCommandBuilder()
        .setName("zerar")
        .setDescription("Zerar inventário"),
    new SlashCommandBuilder()
        .setName("folhas")
        .setDescription("Dividir folhas em 70% e 30%")
        .addIntegerOption(opt => opt.setName("quantidade").setDescription("Quantidade total").setRequired(true)),
    new SlashCommandBuilder()
        .setName("chave")
        .setDescription("Registrar sua chave")
        .addStringOption(opt => opt.setName("numero").setDescription("Número da chave").setRequired(true)),
    new SlashCommandBuilder()
        .setName("removerchave")
        .setDescription("Remover sua chave registrada"),
    new SlashCommandBuilder()
        .setName("removerchaveusuario")
        .setDescription("Remover a chave de outro usuário")
        .addUserOption(opt => opt.setName("usuario").setDescription("Usuário").setRequired(true)),
    new SlashCommandBuilder()
        .setName("minhachave")
        .setDescription("Ver sua chave registrada"),
    new SlashCommandBuilder()
        .setName("casa")
        .setDescription("Listar todas as chaves registradas"),
    new SlashCommandBuilder()
        .setName("ajuda")
        .setDescription("Mostrar painel de ajuda")
].map(cmd => cmd.toJSON());

// ========================================================
// REGISTRAR COMANDOS
// ========================================================

client.once("ready", async () => {
    console.log(`🔥 Bot iniciado como ${client.user.tag}`);

    try {
        const rest = new REST({ version: "10" }).setToken(config.token);
        const guilds = client.guilds.cache.map(g => g.id);

        for (const guildId of guilds) {
            await rest.put(
                Routes.applicationGuildCommands(client.user.id, guildId),
                { body: commands }
            );
            console.log(`✅ Comandos registrados em ${guildId}`);
        }
    } catch (err) {
        console.error("Erro ao registrar comandos:", err);
    }

    const canalId = "1445362491423985795";
    const canal = client.channels.cache.get(canalId);
    if (!canal) return;

    const embed = new EmbedBuilder()
        .setColor(0x00FF75)
        .setTitle("🤖 Bot Online!")
        .setThumbnail(client.user.displayAvatarURL())
        .setDescription(
            "O bot foi iniciado com sucesso!\n\n" +
            "### 📦 Inventário\n" +
            "`/add`, `/listar`, `/remove`, `/zerar`\n\n" +
            "### 🏠 Sistema de Chaves\n" +
            "`/chave`, `/removerchave`, `/removerchaveusuario`, `/minhachave`, `/casa`\n\n" +
            "### ⚙️ Utilidades\n" +
            "`/folhas`\n\n" +
            "### 📘 Ajuda\n" +
            "`/ajuda`\n"
        )
        .setFooter({ text: "Sistema — By José Bonifacio/Peuz" });

    const botoes = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("invent").setLabel("Inventário").setStyle(1).setEmoji("📦"),
        new ButtonBuilder().setCustomId("keys").setLabel("Chaves").setStyle(3).setEmoji("🏠"),
        new ButtonBuilder().setCustomId("utils").setLabel("Outros").setStyle(2).setEmoji("⚙️")
    );

    canal.send({ embeds: [embed], components: [botoes] });
});

// ========================================================
// FUNÇÕES DE INVENTÁRIO
// ========================================================

function gerarInventarioEmbed(pagina = 0, itensPorPagina = 10) {
    const totalPaginas = Math.max(1, Math.ceil(inventario.length / itensPorPagina));
    const inicio = pagina * itensPorPagina;
    const fim = inicio + itensPorPagina;

    const embed = new EmbedBuilder()
        .setColor(0x00FF75)
        .setTitle(`📦 Inventário (Página ${pagina + 1}/${totalPaginas})`)
        .setDescription(
            inventario.length === 0
                ? "📦 Inventário vazio."
                : inventario
                    .slice(inicio, fim)
                    .map((item, i) =>
                        `**${inicio + i + 1}. ${item.nome}** — ${item.quantidade} und — R$${Number(item.valor_total).toFixed(2)}\n` +
                        `👤 Comprador: ${item.comprador}\n` +
                        `🧾 Registrado por: <@${item.registrado_id}>\n`
                    )
                    .join("\n")
        );

    return { embed, totalPaginas };
}

function criarRowPaginacao(pagina, totalPaginas) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("inv_prev")
            .setLabel("⏮️ Anterior")
            .setStyle(1)
            .setDisabled(pagina <= 0),
        new ButtonBuilder()
            .setCustomId("inv_next")
            .setLabel("Próxima ⏭️")
            .setStyle(1)
            .setDisabled(pagina >= totalPaginas - 1)
    );
}

// ========================================================
// HANDLER PRINCIPAL
// ========================================================

client.on("interactionCreate", async (interaction) => {
    try {
        if (interaction.isButton()) {
            if (interaction.customId === "invent")
                return interaction.reply({ content: "`/add`, `/listar`, `/remove`, `/zerar`", ephemeral: true });

            if (interaction.customId === "keys")
                return interaction.reply({ content: "`/chave`, `/removerchave`, `/removerchaveusuario`, `/minhachave`, `/casa`", ephemeral: true });

            if (interaction.customId === "utils")
                return interaction.reply({ content: "`/folhas quantidade`", ephemeral: true });

            if (interaction.customId === "inv_prev" || interaction.customId === "inv_next") {
                const state = paginationStates.get(interaction.message.id);
                if (!state)
                    return interaction.reply({ content: "❌ Página expirada.", ephemeral: true });

                if (interaction.user.id !== state.userId)
                    return interaction.reply({ content: "❌ Apenas quem abriu pode navegar.", ephemeral: true });

                if (interaction.customId === "inv_prev") state.page--;
                if (interaction.customId === "inv_next") state.page++;

                const { embed } = gerarInventarioEmbed(state.page, state.itensPorPagina);
                const row = criarRowPaginacao(state.page, state.totalPages);

                paginationStates.set(interaction.message.id, state);
                return interaction.update({ embeds: [embed], components: [row] });
            }
        }

        if (!interaction.isChatInputCommand()) return;
        const cmd = interaction.commandName;

        if (cmd === "add") {
            const nome = interaction.options.getString("nome");
            const quantidade = interaction.options.getInteger("quantidade");
            const comprador = interaction.options.getString("comprador");
            const valor = interaction.options.getNumber("valor");

            inventario.push({
                nome,
                quantidade,
                comprador,
                valor_total: valor,
                registrado_por: interaction.user.username,
                registrado_id: interaction.user.id,
                foto: interaction.user.displayAvatarURL(),
                timestamp: Date.now()
            });

            salvarInventario();

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x00FF75)
                        .setTitle("✔️ Item adicionado!")
                        .setDescription(
                            `**Item:** ${nome}\n` +
                            `**Quantidade:** ${quantidade}\n` +
                            `**Comprador:** ${comprador}\n` +
                            `**Valor:** R$ ${valor.toFixed(2)}\n`
                        )
                ],
                ephemeral: true
            });
        }

        if (cmd === "listar") {
            if (inventario.length === 0)
                return interaction.reply({ content: "📦 Inventário vazio.", ephemeral: true });

            const itensPorPagina = 10;
            const { embed, totalPaginas } = gerarInventarioEmbed(0, itensPorPagina);
            const row = criarRowPaginacao(0, totalPaginas);

            const msg = await interaction.reply({
                embeds: [embed],
                components: [row],
                ephemeral: true,
                fetchReply: true
            });

            paginationStates.set(msg.id, {
                page: 0,
                totalPages,
                userId: interaction.user.id,
                itensPorPagina
            });
        }

        if (cmd === "remove") {
            const id = interaction.options.getInteger("id");
            if (id < 1 || id > inventario.length)
                return interaction.reply({ content: "❌ ID inválido.", ephemeral: true });

            const removido = inventario.splice(id - 1, 1)[0];
            salvarInventario();

            return interaction.reply({ content: `🗑️ Removido: **${removido.nome}**`, ephemeral: true });
        }

        if (cmd === "zerar") {
            inventario = [];
            salvarInventario();
            return interaction.reply({ content: "🧹 Inventário zerado!", ephemeral: true });
        }

        if (cmd === "folhas") {
            const total = interaction.options.getInteger("quantidade");

            // 70% e 30%
            const p70 = Math.round(total * 0.7); // Nossas
            const p30 = total - p70;             // Produtor

            // Regra de três
            // 50 → 700
            // p70 → X
            // X = (p70 * 700) / 50
            const X = Math.round((p70 * 700) / 50);

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x00FF75)
                        .setTitle("📊 Relatório de Folhas")
                        .setDescription(
                            `📄 **Quantidade Total:** ${total}\n\n` +
                            `🟦 **Produtor (30%)**: ${p30}\n` +
                            `🟩 **Nossas (70%)**: ${p70}\n\n` +
                            `📐 **Regra de Três:**\n` +
                            `> 50 está para 700\n` +
                            `> assim como **${p70}** está para **${X}**\n\n` +
                            `📌 **Resultado Final (X)**: **${X}**`
                        )
                ],
                ephemeral: true
            });
        }

        if (cmd === "chave") {
            const chave = interaction.options.getString("numero");
            chaves[interaction.user.id] = chave;
            salvarChaves();

            return interaction.reply({ content: `🔑 Chave registrada: **${chave}**`, ephemeral: true });
        }

        if (cmd === "removerchave") {
            delete chaves[interaction.user.id];
            salvarChaves();

            return interaction.reply({ content: "🗑️ Sua chave foi removida.", ephemeral: true });
        }

        if (cmd === "removerchaveusuario") {
            const usuario = interaction.options.getUser("usuario");
            if (!chaves[usuario.id])
                return interaction.reply({ content: "❌ Esse usuário não possui chave registrada.", ephemeral: true });

            delete chaves[usuario.id];
            salvarChaves();

            return interaction.reply({ content: `🔑 Chave removida de **${usuario.tag}**`, ephemeral: true });
        }

        if (cmd === "minhachave") {
            const chave = chaves[interaction.user.id];
            return interaction.reply({
                content: chave ? `🔑 Sua chave: **${chave}**` : "❌ Você não tem chave registrada.",
                ephemeral: true
            });
        }

        if (cmd === "casa") {
            if (Object.keys(chaves).length === 0)
                return interaction.reply({ content: "🏠 Nenhuma chave registrada.", ephemeral: true });

            let texto = Object.entries(chaves)
                .map(([id, chave]) => `<@${id}> — **${chave}**`)
                .join("\n");

            return interaction.reply({ content: texto, ephemeral: true });
        }

        if (cmd === "ajuda") {
            const emb = new EmbedBuilder()
                .setColor(0x00A6FF)
                .setTitle("📘 Painel de Ajuda")
                .setDescription("Escolha uma categoria:");

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("invent").setLabel("Inventário").setStyle(1).setEmoji("📦"),
                new ButtonBuilder().setCustomId("keys").setLabel("Chaves").setStyle(3).setEmoji("🏠"),
                new ButtonBuilder().setCustomId("utils").setLabel("Outros").setStyle(2).setEmoji("⚙️")
            );

            return interaction.reply({ embeds: [emb], components: [row], ephemeral: true });
        }

    } catch (err) {
        console.error("Erro:", err);
        try {
            return interaction.reply({ content: "❌ Erro interno.", ephemeral: true });
        } catch { }
    }
});

// ========================================================
// COMANDOS TEXTUAIS (LEGACY)
// ========================================================

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    const prefix = "!";
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    if (cmd === "add") {
        const nome = args[0];
        const quantidade = parseInt(args[1]);
        const comprador = args[2];
        const valor = parseFloat(args[3]);

        if (!nome || isNaN(quantidade) || !comprador || isNaN(valor))
            return message.reply("❌ Uso: `!add nome quantidade comprador valor`");

        inventario.push({
            nome,
            quantidade,
            comprador,
            valor_total: valor,
            registrado_id: message.author.id,
            registrado_por: message.author.username
        });

        salvarInventario();
        return message.reply(`✔️ Adicionado: **${nome}**`);
    }
});

// ========================================================
// LOGIN
// ========================================================

client.login(process.env.DISCORD_TOKEN);
