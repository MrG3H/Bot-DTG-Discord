// BY: MrGeH - Versão Final v30

require('dotenv').config();
const fs = require('fs');
const fetch = require('node-fetch');
const { Pool } = require('pg'); 

const {
    Client, GatewayIntentBits, EmbedBuilder, ActivityType, ModalBuilder,
    TextInputBuilder, TextInputStyle, ActionRowBuilder, Collection,
    PermissionFlagsBits, MessageFlags, StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, ComponentType,
    ChannelType
} = require('discord.js');

const { translate } = require('@vitalets/google-translate-api');

const TOKEN = process.env.DISCORD_TOKEN;
const OWNER_ID = process.env.OWNER_ID;
const PREFIX = '!dtg';
const DATABASE_URL = process.env.DATABASE_URL;

// GIF Fixo
const AVISO_GIF_URL = "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExamQxcGRlanRhNWZvNnBnNnM3MDhqYXR2MmJ2czE1ZTQ0N2NkZHJsNyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/vqGMs1Sgv0y5gnbkMP/giphy.gif";

if (!TOKEN || !OWNER_ID || !process.env.DISCORD_CLIENT_ID || !DATABASE_URL) {
    console.error("Erro: .env incompleto.");
    process.exit(1);
}

// --- CONEXÃO POSTGRESQL (COM PROTEÇÃO ANTI-CRASH E KEEPALIVE) ---
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    keepAlive: true // Mantém a conexão ativa para evitar quedas de rede
});

// Tratamento de erro no Pool (Conexões Ociosas)
pool.on('error', (err, client) => {
    console.error('⚠️ Erro no Pool do PostgreSQL (não fatal):', err.message);
});

// Testa conexão ao iniciar E LIBERA O CLIENTE (Correção do Crash)
pool.connect()
    .then(client => {
        console.log('✅ Conectado ao PostgreSQL com sucesso!');
        client.release(); // IMPORTANTE: Libera a conexão de volta pro pool
    })
    .catch(err => console.error('❌ Erro fatal ao conectar no PostgreSQL:', err));

// --- CONFIGURAÇÃO ---
const configPath = './config.json';
function loadConfig() {
    const defaultStructure = { presentationChannelId: null, logChannelId: null, welcomeChannelId: null, reportChannelId: null };
    if (fs.existsSync(configPath)) {
        try { 
            const current = JSON.parse(fs.readFileSync(configPath, 'utf8')); 
            return { ...defaultStructure, ...current }; 
        } catch (error) { return defaultStructure; }
    }
    fs.writeFileSync(configPath, JSON.stringify(defaultStructure, null, 2));
    return defaultStructure;
}
let config = loadConfig();
function saveConfig() { fs.writeFileSync(configPath, JSON.stringify(config, null, 2)); }

// --- FUNÇÃO GERADORA DE TAGS ---
function gerarTagsAutomaticas(titulo) {
    const t = titulo.toLowerCase();
    const limpo = t.replace(/[^a-z0-9 ]/g, '');
    const palavras = limpo.split(' ');
    const sigla = palavras.map(p => p.length > 0 ? p[0] : '').join('');
    return `${t} ${limpo} ${sigla}`;
}

// --- DADOS DO FAQ ---
const FAQ_DATA = {
    'instalar': { 
        title: '🛠️ Como Instalar / How to Install', 
        desc: '🇧🇷\n1. Baixe o arquivo através do arquivo torrent.\n2. Desative o Antivírus (Cracks são falsos positivos).\n3. Caso o arquivo seja .iso de dois cliques e ele irá montar a imagem. Caso seja arquivo compactado como .zip, .rar, 7z, utilize um descompactador de arquivos seja winRAR, 7zip ou algum outro de sua preferência. \n4. Execute o "Setup.exe" em casos de arquivos .iso, normalmente jogos compactados eles já são o jogo instalado.\n\n🇺🇸\n1. Download the file using the torrent file.\n2. Disable your Antivirus (Cracks are false positives).\n3. If the file is a .iso, double-click it to mount the image. If it is a compressed file like .zip, .rar, or 7z, use a file extractor such as WinRAR, 7-Zip, or another of your preference. \n4. Run "Setup.exe" for .iso files; compressed games are usually already the installed game.' 
    },
    'dll': { 
        title: '⚠️ Erro de DLL / DLL Error', 
        desc: '🇧🇷\nErro de DLL normalmente é falta de drivers adicionais, seja de padrão do Windows como vcredist... Agora, se for algo referente a abrir o jogo e faltar DLL referente ao crack, você deve colar o crack novamente (OBS.: DESATIVAR ANTIVÍRUS).\n\n🇺🇸\nDLL errors are usually due to missing additional drivers, whether standard Windows ones like vcredist... Now, if it refers to opening the game and a crack DLL is missing, you must paste the crack again (NOTE: DISABLE ANTIVIRUS).' 
    },
    'online': { 
        title: '🌐 Jogar Online / Play Online', 
        desc: '🇧🇷 Jogos que funcionam online e somente na aba Co-op|Online (OBS: sempre pergunte no chat de dúvidas se o jogo co-op|online está atualizado). \n\n🇺🇸 Games that work online and only in the Co-op|Online tab (NOTE: always ask in the chat if the co-op|online game is up to date).' 
    },
    'pedido': { 
        title: '📦 Como Pedir / How to Request', 
        desc: '🇧🇷 Vá ao canal de pedidos, clique em "Fazer Pedido" e preencha o formulário. \n\n🇺🇸 Go to the order channel, click on "Make Request" and fill out the form.' 
    }
};

const embedColors = ['#5865F2', '#0099ff', '#41B454', '#E67E22', '#E91E63', '#9B59B6', '#F1C40F', '#1ABC9C', '#2ECC71', '#3498DB', '#E74C3C'];
function getRandomColor() { return embedColors[Math.floor(Math.random() * embedColors.length)]; }

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildMembers]
});

client.tempPedidoData = new Collection();
client.tempAddJogoData = new Collection();
client.activeChats = new Collection();

client.on('clientReady', () => { 
    console.log(`Bot ${client.user.tag} está online!`);
    let i = 0;
    const activities = ['Melhor Discord de Jogos', 'Criado por MrGeH!', 'Use /dtg linkquebrado', 'Best Discord Games'];
    setInterval(() => { client.user.setActivity(activities[i++ % activities.length], { type: ActivityType.Playing }); }, 15000);
});

// --- EVENTO DE BOAS-VINDAS ---
client.on('guildMemberAdd', async member => {
    if (!config.welcomeChannelId) return;
    const channel = member.guild.channels.cache.get(config.welcomeChannelId);
    if (!channel) return;

    let desc = `🇧🇷 Seja bem-vindo(a) à **DownTorrentsGames**! <@${member.id}>\nLeia as regras e aproveite o conteúdo!\n\n`;
    desc += `🇺🇸 Welcome to **DownTorrentsGames**! <@${member.id}>\nRead the rules and enjoy the content!\n\n`;
    
    try {
        const res = await pool.query('SELECT titulo, link, tipo FROM jogos ORDER BY id DESC LIMIT 5');
        if (res.rows.length > 0) {
            desc += `---------------------------------\n**🔥 Últimos Lançamentos / Last Releases:**\n`;
            res.rows.forEach(g => desc += `• [${g.titulo}](${g.link}) (${g.tipo === 'jogo' ? '🎮' : '💾'})\n`);
        }
    } catch (e) {}

    const embed = new EmbedBuilder().setTitle(`Bem-vindo à Tripulação Pirata🏴‍☠️`).setDescription(desc).setThumbnail(member.user.displayAvatarURL()).setColor(getRandomColor()).setImage(AVISO_GIF_URL);
    await channel.send({ content: `<@${member.id}>`, embeds: [embed] });
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    
    // Auto-Mod
    if (message.author.id !== OWNER_ID && !message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
        if (message.content.toLowerCase().includes('discord.gg/') || (message.content.includes('http') && message.attachments.size === 0)) {
            await message.delete().catch(()=>{});
            const w = await message.channel.send(`🚫 ${message.author}, links não permitidos!`);
            setTimeout(()=>w.delete().catch(()=>{}), 5000);
            return;
        }
    }

    // Chat Relay
    if (message.channel.type === ChannelType.DM) {
        const cId = client.activeChats.get(message.author.id);
        if (cId) {
            const c = client.channels.cache.get(cId);
            if (c) {
                const files = message.attachments.map(a => a.url);
                await c.send({ embeds: [new EmbedBuilder().setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()}).setDescription(message.content||'*Arquivo*').setColor('#00ff00')], files });
                await message.react('📨');
            }
            return;
        }
    }
    if (message.guild && client.activeChats.has(message.channel.id)) {
        const tId = client.activeChats.get(message.channel.id);
        const tUser = await client.users.fetch(tId).catch(()=>null);
        if (tUser) {
            const files = message.attachments.map(a => a.url);
            try { await tUser.send({ embeds: [new EmbedBuilder().setAuthor({name:`Staff: ${message.author.username}`, iconURL:message.guild.iconURL()}).setDescription(message.content||'*Arquivo*').setColor('#ff0000')], files }); await message.react('✅'); } catch(e) { message.reply('❌ Falha DM.'); }
        }
        return;
    }

    // Add Jogo/Soft (DB)
    if (client.tempAddJogoData.has(message.author.id)) {
        const data = client.tempAddJogoData.get(message.author.id);
        if (data.status === 'awaiting_image') {
            const att = message.attachments.first();
            if (att && att.contentType.startsWith('image')) {
                client.tempAddJogoData.delete(message.author.id);
                const tags = gerarTagsAutomaticas(data.title);
                try {
                    await pool.query('INSERT INTO jogos (titulo, link, tipo, obs, tags_busca) VALUES ($1, $2, $3, $4, $5)', [data.title, data.link, data.type, data.obs||'', tags]);
                    await sendGameOrSoftwareEmbed(data.interaction, data.primaryChannelId, data.notificationChannelId, data.title, data.obs, data.link, att.url, data.type);
                    if(data.waitingMessageId) (await message.channel.messages.fetch(data.waitingMessageId)).delete().catch(()=>{});
                    await message.react('✅');
                } catch(e) { await message.reply('❌ Erro DB.'); }
                return;
            } else { await message.reply('❌ Mande imagem.'); }
        }
    }

    if (!message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();
    if (cmd === 'ajuda') await handleAjudaPrefix(message);
    else if (cmd === 'ajogo') message.reply('Use `/dtg addjogo`.');
});

client.on('interactionCreate', async interaction => {
    if (!interaction.guild) { if (interaction.isRepliable()) return interaction.reply({content:'Use em servidor.', flags:[MessageFlags.Ephemeral]}); return; }

    if (interaction.isChatInputCommand()) {
        const { commandName, options } = interaction;
        if (commandName === 'dtg') {
            const subcommand = options.getSubcommand();
            const ownerOnly = ['aviso', 'addsoft', 'addjogo', 'limpar', 'addpedido', 'setup_faq', 'config_boasvindas', 'chat', 'configquebrado'];
            
            if (ownerOnly.includes(subcommand) && interaction.user.id !== OWNER_ID) return interaction.reply({ content: '❌ Apenas o dono.', flags: [MessageFlags.Ephemeral] });

            if (subcommand === 'ajuda') await handleAjudaSlash(interaction);
            else if (subcommand === 'buscar') {
                const termo = options.getString('nome').toLowerCase().trim();
                try {
                    const res = await pool.query(`SELECT * FROM jogos WHERE tags_busca ILIKE $1 OR titulo ILIKE $1 LIMIT 10`, [`%${termo}%`]);
                    if (res.rows.length === 0) return interaction.reply({content:`❌ Nada encontrado para: **${termo}**.`, flags:[MessageFlags.Ephemeral]});
                    let desc = `🔎 **Resultados:**\n\n`;
                    res.rows.forEach(r => desc += `${r.tipo==='jogo'?'🎮':'💾'} **[${r.titulo}](${r.link})**\n`);
                    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('📚 Busca de Jogos DTG').setDescription(desc).setColor('#00FF00')], flags: [MessageFlags.Ephemeral] });
                } catch(e) { interaction.reply({content:'❌ Erro na busca.', flags:[MessageFlags.Ephemeral]}); }
            }
            else if (subcommand === 'configquebrado') {
                config.reportChannelId = options.getChannel('canal').id;
                saveConfig();
                await interaction.reply({ content: `✅ Canal de reports configurado!`, flags: [MessageFlags.Ephemeral] });
            }
            else if (subcommand === 'linkquebrado') {
                if (!config.reportChannelId) return interaction.reply({ content: '❌ Sistema não configurado.', flags: [MessageFlags.Ephemeral] });
                const isPt = interaction.locale === 'pt-BR';
                const modal = new ModalBuilder().setCustomId(`report_broken_link_modal`).setTitle(isPt ? 'Reportar Link' : 'Report Broken Link');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('broken_game_name').setLabel(isPt ? 'Nome do jogo:' : 'Game Name:').setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('broken_obs').setLabel(isPt ? 'Obs:' : 'Obs:').setStyle(TextInputStyle.Paragraph).setRequired(false)));
                await interaction.showModal(modal);
            }
            else if (subcommand === 'aviso') await handleAvisoChat(interaction);
            else if (subcommand === 'chat') { const u = options.getUser('usuario'); await createChatChannel(interaction, u.id); }
            else if (subcommand === 'addsoft') { 
                const p = options.getChannel('canal_principal'); const n = options.getChannel('canal_notificacao');
                const m = new ModalBuilder().setCustomId(`addsoft_modal_${p.id}_${n.id}`).setTitle('Add Soft');
                m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('addsoft_titulo').setLabel("Título").setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('addsoft_link').setLabel("Link").setStyle(TextInputStyle.Short).setRequired(true)));
                await interaction.showModal(m);
            }
            else if (subcommand === 'addjogo') { 
                const p = options.getChannel('canal_principal'); const n = options.getChannel('canal_notificacao');
                const m = new ModalBuilder().setCustomId(`addjogo_modal_${p.id}_${n.id}`).setTitle('Add Jogo');
                m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('addjogo_titulo').setLabel("Título").setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('addjogo_obs').setLabel("Obs").setStyle(TextInputStyle.Paragraph).setRequired(false)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('addjogo_link').setLabel("Link").setStyle(TextInputStyle.Short).setRequired(true)));
                await interaction.showModal(m);
            }
            else if (subcommand === 'addpedido') {
                const pc = options.getChannel('canal_apresentacao'); const lc = options.getChannel('canal_logs');
                config.presentationChannelId = pc.id; config.logChannelId = lc.id; saveConfig();
                await pc.send({ content: `**🇧🇷 Faça o Pedido:**\n\n**🇺🇸 Make your Request:**\n\n${AVISO_GIF_URL}`, components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('iniciar_pedido_pt').setLabel('Fazer Pedido!').setStyle(ButtonStyle.Success).setEmoji('🇧🇷'), new ButtonBuilder().setCustomId('iniciar_pedido_en').setLabel('Make Request!').setStyle(ButtonStyle.Primary).setEmoji('🇺🇸'))] });
                await interaction.reply({ content: `✅ Configurado!`, flags: [MessageFlags.Ephemeral] });
            }
            else if (subcommand === 'pedido' || subcommand === 'order') await sendPedidoInitialEphemeralMessage(interaction, subcommand === 'order');
            else if (subcommand === 'setup_faq') {
                await interaction.channel.send({ embeds: [new EmbedBuilder().setTitle('❓ Central de Ajuda').setColor('#00FF00').setThumbnail(AVISO_GIF_URL)], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('open_faq_menu').setLabel('Ajuda / Help').setStyle(ButtonStyle.Success).setEmoji('💡'))] });
                await interaction.reply({ content: '✅ FAQ criado!', flags: [MessageFlags.Ephemeral] });
            }
            else if (subcommand === 'limpar') await handleLimparSlash(interaction);
            else if (subcommand === 'config_boasvindas') { config.welcomeChannelId = options.getChannel('canal').id; saveConfig(); await interaction.reply({ content: '✅ Configurado!', flags: [MessageFlags.Ephemeral] }); }
            else if (subcommand === 'convite') await interaction.reply({ content: `${AVISO_GIF_URL}\n\n**Convite:** https://discord.gg/uKCrBCNqCT` });
        }
    }
    
    else if (interaction.isButton()) {
        if (interaction.customId === 'iniciar_pedido_pt' || interaction.customId === 'iniciar_pedido_en') { await sendPedidoInitialEphemeralMessage(interaction, interaction.customId === 'iniciar_pedido_en'); return; }
        if (interaction.customId === 'open_faq_menu') {
            const select = new StringSelectMenuBuilder().setCustomId('faq_select').setPlaceholder('Selecione / Select').addOptions(Object.keys(FAQ_DATA).map(k => new StringSelectMenuOptionBuilder().setLabel(FAQ_DATA[k].title.substring(0, 25)).setValue(k)));
            await interaction.reply({ components: [new ActionRowBuilder().addComponents(select)], flags: [MessageFlags.Ephemeral] });
        }
        if (interaction.customId.startsWith('pedido_continue_button_')) {
             const parts = interaction.customId.split('_'); const userId = parts[3]; const lang = parts[4]; const isEn = lang === 'en';
             if (interaction.user.id !== userId) return interaction.reply({ content: '❌', flags: [MessageFlags.Ephemeral] });
             const d = client.tempPedidoData.get(userId);
             if (!d || !d.platform) return interaction.reply({ content: '❌', flags: [MessageFlags.Ephemeral] });
             await handlePedidoModalFinal(interaction, d.platform, d.online, isEn);
             try { setTimeout(async () => { try { await interaction.message.delete(); } catch(e) {} }, 1000); } catch(e){}
             client.tempPedidoData.delete(userId);
        }
        if (interaction.customId.startsWith('start_chat_')) await createChatChannel(interaction, interaction.customId.split('_')[2]);
        if (interaction.customId.startsWith('close_chat_')) {
            const tId = interaction.customId.split('_')[2]; const c = interaction.channel;
            await interaction.reply({ content: '🔒 Fechando...', flags: [MessageFlags.Ephemeral] });
            try {
                if (config.logChannelId) { const msgs = await c.messages.fetch({limit:100}); const txt=msgs.reverse().map(m=>`[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}`).join('\n'); const l=await client.channels.fetch(config.logChannelId); if(l) l.send({content:`Backup <@${tId}>`, files:[{attachment:Buffer.from(txt),name:'log.txt'}]}); }
                client.activeChats.delete(tId); client.activeChats.delete(c.id); setTimeout(()=>c.delete(), 5000);
            } catch(e){}
        }
        if (interaction.customId.startsWith('pedido_res|')) {
            if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: '❌', flags: [MessageFlags.Ephemeral] });
            const parts = interaction.customId.split('|'); const action = parts[1]; const uId = parts[2]; const gName = parts[3].replace(/_/g, ' '); const lang = parts[6];
            await interaction.deferUpdate();
            try { 
                const u = await client.users.fetch(uId); 
                const title = lang === 'en' ? (action==='added'?"ADDED!":"NOTICE") : (action==='added'?"ADICIONADO!":"AVISO");
                const body = lang === 'en' ? (action==='added'?`Request **${gName}** fulfilled!`:`Request **${gName}** rejected.`) : (action==='added'?`Pedido **${gName}** atendido!`:`Pedido **${gName}** negado (Sem Crack).`);
                await u.send(`${title}\n\n${body}\n\n**MrGeH**`);
                await interaction.message.edit({ components: [] }); 
                await interaction.channel.send(`*Resolvido por ${interaction.user.tag}*`);
            } catch(e) {}
        }
        if (interaction.customId.startsWith('fix_link|')) {
            await interaction.deferUpdate();
            const parts = interaction.customId.split('|'); const tId = parts[1]; const gName = parts[2];
            try {
                const u = await client.users.fetch(tId);
                await u.send(`🇧🇷 Seu reporte referente ao link quebrado do jogo **${gName}** foi corrigido.\n\n---------------------------------\n\n🇺🇸 Your report regarding the broken link for game **${gName}** has been fixed.\n\n**Obrigado! / Thank you!**`);
                const oldEmbed = interaction.message.embeds[0];
                const newEmbed = EmbedBuilder.from(oldEmbed).setColor('#00FF00').setFooter({ text: `✅ Resolvido por ${interaction.user.username}` });
                await interaction.message.edit({ embeds: [newEmbed], components: [] });
            } catch (e) {
                await interaction.followUp({ content: '⚠️ Link corrigido, mas DM falhou (Bloqueado).', flags: [MessageFlags.Ephemeral] });
                const oldEmbed = interaction.message.embeds[0];
                const newEmbed = EmbedBuilder.from(oldEmbed).setColor('#FFFF00').setFooter({ text: `⚠️ Resolvido por ${interaction.user.username} (DM Falhou)` });
                await interaction.message.edit({ embeds: [newEmbed], components: [] });
            }
        }
    }

    else if (interaction.isModalSubmit()) {
        const { customId, fields } = interaction;
        
        if (customId === 'report_broken_link_modal') {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            const name = fields.getTextInputValue('broken_game_name');
            const obs = fields.getTextInputValue('broken_obs');
            const rc = await client.channels.fetch(config.reportChannelId).catch(()=>null);
            if (!rc) return interaction.editReply('❌ Erro: Canal de reports não configurado.');
            const embed = new EmbedBuilder().setTitle('🚨 Reporte de Link Quebrado').setColor('#FF0000').addFields({name:'👤 Usuário', value:`<@${interaction.user.id}>`, inline:true}, {name:'🎮 Jogo', value:name, inline:true}, {name:'📝 Obs', value:obs||'Nenhuma.'}).setTimestamp().setThumbnail(AVISO_GIF_URL);
            const safeName = name.length > 50 ? name.substring(0,50)+'...' : name;
            const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`fix_link|${interaction.user.id}|${safeName.replace(/\|/g,'-')}`).setLabel('Link Corrigido').setStyle(ButtonStyle.Success).setEmoji('🔧'));
            await rc.send({ embeds: [embed], components: [btn] });
            await interaction.editReply('✅ Reporte enviado! / Report sent!');
        }

        else if (customId.startsWith('pedido_modal_final|')) {
             await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
             const parts = customId.split('|'); const u = parts[1]; const plat = parts[2]; const on = parts[3]; const lang = parts[4];
             const name = fields.getTextInputValue('pedido_game_software_name').replace(/\|/g, '-');
             const link = fields.getTextInputValue('pedido_original_link');
             const info = fields.getTextInputValue('pedido_info_msg');
             const log = await client.channels.fetch(config.logChannelId);
             const embed = new EmbedBuilder().setTitle(lang==='en'?'📦 New Request':'📦 Novo Pedido').setColor(getRandomColor()).setDescription(`User: <@${u}>\nName: ${name}\nPlat: ${plat}\nLink: ${link}\nInfo: ${info}`);
             const btns = new ActionRowBuilder().addComponents(
                 new ButtonBuilder().setCustomId(`pedido_res|added|${u}|${name.replace(/ /g,'_')}|${plat.replace(/ /g,'_')}|${on.replace(/ /g,'_')}|${lang}`).setLabel('Add').setStyle(ButtonStyle.Success),
                 new ButtonBuilder().setCustomId(`pedido_res|rejected|${u}|${name.replace(/ /g,'_')}|${plat.replace(/ /g,'_')}|${on.replace(/ /g,'_')}|${lang}`).setLabel('No Crack').setStyle(ButtonStyle.Danger),
                 new ButtonBuilder().setCustomId(`start_chat_${u}`).setLabel('Chat').setStyle(ButtonStyle.Primary)
             );
             await log.send({ embeds: [embed], components: [btns] });
             await interaction.editReply({ content: '✅' });
             client.tempPedidoData.delete(u);
        }
        else if (customId.startsWith('addsoft_modal_') || customId.startsWith('addjogo_modal_')) {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            const isJ = customId.startsWith('addjogo'); const [, , pId, nId] = customId.split('_');
            const tit = fields.getTextInputValue(isJ?'addjogo_titulo':'addsoft_titulo'); 
            const link = fields.getTextInputValue(isJ?'addjogo_link':'addsoft_link'); 
            const obs = isJ?fields.getTextInputValue('addjogo_obs'):null;
            client.tempAddJogoData.set(interaction.user.id, { status: 'awaiting_image', interaction, primaryChannelId: pId, notificationChannelId: nId, title: tit, obs, link, type: isJ?'jogo':'software' });
            const msg = await interaction.editReply('✅ Mande a IMAGEM.');
            const d = client.tempAddJogoData.get(interaction.user.id); d.waitingMessageId = msg.id; client.tempAddJogoData.set(interaction.user.id, d);
        }
        
        else if (customId.startsWith('aviso_modal_|')) {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            const parts = customId.split('|');
            const targetChannelId = parts[1]; // Recupera ID Seguro

            const tit = fields.getTextInputValue('aviso_titulo');
            const corpo = fields.getTextInputValue('aviso_corpo');
            
            let desc = corpo;
            try { 
                const resTitle = await translate(tit, {to:'en'});
                const resBody = await translate(corpo, {to:'en'});
                desc = `🇧🇷 ${corpo}\n\n---------------------\n\n🇺🇸 **${resTitle.text}**\n\n${resBody.text}`;
            } catch(e){}

            const embed = new EmbedBuilder().setTitle(`🇧🇷 ${tit}`).setDescription(desc).setColor(getRandomColor()).setThumbnail(AVISO_GIF_URL);
            
            try {
                const c = await client.channels.fetch(targetChannelId);
                await c.send({content:'@everyone', embeds:[embed]});
                await interaction.editReply('✅ Enviado.');
            } catch(e){
                await interaction.editReply('❌ Erro: Canal não encontrado.');
            }
        }
    }
});

// --- FUNÇÕES AUXILIARES ---
async function sendGameOrSoftwareEmbed(oi, pid, nid, tit, obs, lnk, img, typ) {
    const mc = await oi.guild.channels.fetch(pid); const nc = await oi.guild.channels.fetch(nid);
    let finalObs = '';
    if (obs) { try { const tr = await translate(obs, {to:'en'}); finalObs = `\n\n**Observação / Note:**\n🇧🇷 ${obs}\n---------------------\n🇺🇸 ${tr.text}`; } catch(e) { finalObs=`\n\n**Obs:** ${obs}`; } }
    const m = await mc.send({ content: `**${tit}**\n\n**Link:** [Clique Aqui! | Click Here!](${lnk})${finalObs}`, files: img ? [{ attachment: img, name: 'image.png' }] : [] });
    const emb = new EmbedBuilder().setTitle(`🎉 Novo ${typ==='jogo'?'Jogo':'Software'}!`).setColor(getRandomColor()).setDescription(`🇧🇷 Confira: **${tit}**\n🇺🇸 Check out: **${tit}**`).setThumbnail(img);
    await nc.send({ content: '@everyone', embeds: [emb], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Clique Aqui / Click Here').setURL(m.url))] });
    await oi.editReply('✅ Sucesso!');
}

async function handleAjudaPrefix(m){ m.reply('Use `/dtg`.'); }
async function handleAjudaSlash(i){ i.reply({content:'Use os comandos `/dtg`.', flags:[MessageFlags.Ephemeral]}); }

// --- FUNÇÃO DO AVISO CORRIGIDA (SEM USAR MEMÓRIA TEMPORÁRIA) ---
async function handleAvisoChat(i) {
    const c = i.options.getChannel('canal') || i.channel;
    // Passa o ID do canal no CustomID para garantir persistência
    const m = new ModalBuilder().setCustomId(`aviso_modal_|${c.id}`).setTitle('Aviso');
    m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('aviso_titulo').setLabel('Título').setStyle(TextInputStyle.Short)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('aviso_corpo').setLabel('Mensagem').setStyle(TextInputStyle.Paragraph)));
    await i.showModal(m);
}

async function handleLimparSlash(i){ const q=i.options.getInteger('quantidade'); await i.channel.bulkDelete(q, true); i.reply({content:`Apagadas ${q}`, flags:[MessageFlags.Ephemeral]}); }
async function handlePedidoModalFinal(i, p, o, isEn) { /* Lógica mantida no evento modal acima */ }
async function createChatChannel(i, tId) {
    if(client.activeChats.has(tId)) return i.reply({content:'⚠️ Chat já existe.', flags:[MessageFlags.Ephemeral]});
    if(!i.replied) await i.deferReply({flags:[MessageFlags.Ephemeral]});
    try {
        const u = await client.users.fetch(tId);
        const c = await i.guild.channels.create({ name:`chat-${u.username}`, type:ChannelType.GuildText, permissionOverwrites:[{id:i.guild.id,deny:[PermissionFlagsBits.ViewChannel]},{id:client.user.id,allow:[PermissionFlagsBits.ViewChannel]},{id:i.user.id,allow:[PermissionFlagsBits.ViewChannel]}] });
        client.activeChats.set(tId, c.id); client.activeChats.set(c.id, tId);
        await c.send({ content: `👋 Chat com ${u} iniciado.`, components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`close_chat_${tId}`).setLabel('Fechar').setStyle(ButtonStyle.Danger))] });
        try { await u.send('📩 **Suporte Iniciado!** Responda por aqui.'); } catch(e) { await c.send('⚠️ DMs fechadas.'); }
        await i.editReply(`✅ Chat: ${c}`);
    } catch(e) { i.editReply('❌ Erro.'); }
}
function getPedidoPlatformSelectMenu(u,l,v) { const opts=[{l:'PC',v:'PC'},{l:'PS4',v:'PS4'},{l:'PS5',v:'PS5'},{l:'XBONE',v:'XBOX ONE'},{l:'XBS',v:'XBOX SERIES'},{l:'SWITCH',v:'NINTENDO SWITCH'},{l:'OUTROS',v:'OUTROS'}].map(x=>new StringSelectMenuOptionBuilder().setLabel(x.l).setValue(x.v).setDefault(x.v===v)); return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`pedido_platform_select_${u}_${l}`).setPlaceholder('Plat').addOptions(opts)); }
function getPedidoOnlineSelectMenu(u,l,v) { const opts=[{l:'Sim',v:'Sim'},{l:'Não',v:'Não'}].map(x=>new StringSelectMenuOptionBuilder().setLabel(x.l).setValue(x.v).setDefault(x.v===v)); return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`pedido_online_select_${u}_${l}`).setPlaceholder('Online?').addOptions(opts)); }
async function sendPedidoInitialEphemeralMessage(i,e){
    await i.deferReply({flags:[MessageFlags.Ephemeral]}); const u=i.user.id; const l=e?'en':'pt'; client.tempPedidoData.set(u,{});
    await i.editReply({content:l==='en'?'Select:':'Selecione:',components:[getPedidoPlatformSelectMenu(u,l),getPedidoOnlineSelectMenu(u,l),new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`pedido_continue_button_${u}_${l}`).setLabel(l==='en'?'Continue':'Continuar').setStyle(ButtonStyle.Success).setDisabled(true))]});
}

// ANTI-CRASH GLOBAL (Proteção Extra)
process.on('uncaughtException', (err) => { console.error('⚠️ Uncaught Exception:', err); });
process.on('unhandledRejection', (reason, promise) => { console.error('⚠️ Unhandled Rejection:', reason); });

client.login(TOKEN);