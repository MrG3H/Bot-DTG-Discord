// BY: MrGeH - Versão Final v23

require('dotenv').config();
const fs = require('fs');
const fetch = require('node-fetch');

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

// GIF Fixo para os Avisos e Boas-vindas
const AVISO_GIF_URL = "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExamQxcGRlanRhNWZvNnBnNnM3MDhqYXR2MmJ2czE1ZTQ0N2NkZHJsNyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/vqGMs1Sgv0y5gnbkMP/giphy.gif";

if (!TOKEN || !OWNER_ID || !process.env.DISCORD_CLIENT_ID) {
    console.error("Erro: .env incompleto.");
    process.exit(1);
}

// --- CONFIGURAÇÃO (config.json) ---
const configPath = './config.json';
function loadConfig() {
    if (fs.existsSync(configPath)) {
        try { return JSON.parse(fs.readFileSync(configPath, 'utf8')); } 
        catch (error) { return { presentationChannelId: null, logChannelId: null, welcomeChannelId: null }; }
    }
    const def = { presentationChannelId: null, logChannelId: null, welcomeChannelId: null };
    fs.writeFileSync(configPath, JSON.stringify(def, null, 2));
    return def;
}
let config = loadConfig();
function saveConfig() { fs.writeFileSync(configPath, JSON.stringify(config, null, 2)); }

// --- SISTEMA DE ÚLTIMOS LANÇAMENTOS (JSON PERSISTENTE) ---
const releasesPath = './ultimosLancamentos.json';
let ultimosLancamentos = [];

function loadReleases() {
    if (fs.existsSync(releasesPath)) {
        try { return JSON.parse(fs.readFileSync(releasesPath, 'utf8')); } 
        catch (e) { return []; }
    }
    return [];
}
function saveReleases() {
    fs.writeFileSync(releasesPath, JSON.stringify(ultimosLancamentos, null, 2));
}
// Carrega ao iniciar
ultimosLancamentos = loadReleases();

// --- DADOS DO FAQ ---
const FAQ_DATA = {
    'instalar': {
        title: '🛠️ Como Instalar / How to Install',
        desc: '1. Baixe o arquivo.\n2. Desative o Antivírus (Cracks são falsos positivos).\n3. Extraia com WinRAR/7-Zip.\n4. Execute o "Setup.exe".\n\n🇬🇧 1. Download. 2. Disable AV. 3. Extract. 4. Run Setup.'
    },
    'dll': {
        title: '⚠️ Erro de DLL / DLL Error',
        desc: 'Erro de DLL (isdone.dll, unarc.dll)? Instale "Visual C++ Redistributable All-in-One" e "DirectX". Veja na aba Softwares.'
    },
    'online': {
        title: '🌐 Jogar Online / Play Online',
        desc: 'Jogos piratas geralmente NÃO funcionam online oficial. Procure na categoria "Online-Fix" ou "Co-op".'
    },
    'pedido': {
        title: '📦 Como Pedir / How to Request',
        desc: 'Vá ao canal de pedidos, clique em "Fazer Pedido" e preencha o formulário.'
    }
};

const embedColors = ['#5865F2', '#0099ff', '#41B454', '#E67E22', '#E91E63', '#9B59B6', '#F1C40F', '#1ABC9C', '#2ECC71', '#3498DB', '#E74C3C'];
function getRandomColor() { return embedColors[Math.floor(Math.random() * embedColors.length)]; }

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers
    ]
});

const cooldowns = new Collection();
const prefixCooldowns = new Collection();
client.tempPedidoData = new Collection();
client.tempAvisoData = new Collection();
client.tempAddJogoData = new Collection();
client.activeChats = new Collection();

client.on('clientReady', () => { 
    console.log(`Bot ${client.user.tag} está online!`);
    const activities = ['Melhor Discord de Jogos', 'Criado por MrGeH!', 'Siga as Regras!', 'Aqui e o Brasil!', 'Best Discord Games', 'Created by MrGeH!', 'Follow Rules!'];
    let i = 0;
    setInterval(() => {
        client.user.setActivity(activities[i], { type: ActivityType.Playing });
        i = ++i % activities.length;
    }, 15000);
});

// --- EVENTO DE BOAS-VINDAS ---
client.on('guildMemberAdd', async member => {
    if (!config.welcomeChannelId) return;
    const channel = member.guild.channels.cache.get(config.welcomeChannelId);
    if (!channel) return;

    // Mensagem dividida em PT e EN
    let desc = `🇧🇷 Seja bem-vindo(a) à **DownTorrentsGames**! <@${member.id}>\nLeia as regras e aproveite o conteúdo!\n\n`;
    desc += `🇺🇸 Welcome to **DownTorrentsGames**! <@${member.id}>\nRead the rules and enjoy the content!\n\n`;
    
    if (ultimosLancamentos.length > 0) {
        desc += `---------------------------------\n`;
        desc += `**🔥 Últimos Lançamentos / Last Releases:**\n`;
        ultimosLancamentos.forEach(game => {
            desc += `• [${game.title}](${game.link}) (${game.type === 'jogo' ? '🎮' : '💾'})\n`;
        });
    }

    const embed = new EmbedBuilder()
        .setTitle(`Bem-vindo à Tripulação Pirata🏴‍☠️ | Welcome to the Pirate Crew 🏴‍☠️`)
        .setDescription(desc)
        .setThumbnail(member.user.displayAvatarURL())
        .setColor(getRandomColor())
        .setImage(AVISO_GIF_URL);

    await channel.send({ content: `<@${member.id}>`, embeds: [embed] });
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // --- AUTO-MODERAÇÃO ---
    if (message.author.id !== OWNER_ID && !message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
        const content = message.content.toLowerCase();
        if (content.includes('discord.gg/') || content.includes('discord.com/invite') || (content.includes('http') && message.attachments.size === 0)) {
            await message.delete().catch(() => {});
            const warning = await message.channel.send(`🚫 ${message.author}, links externos não são permitidos!`);
            setTimeout(() => warning.delete().catch(() => {}), 5000);
            return; 
        }
    }

    // --- CHAT PRIVADO (RELAY) ---
    if (message.channel.type === ChannelType.DM) {
        const activeChannelId = client.activeChats.get(message.author.id);
        if (activeChannelId) {
            const channel = client.channels.cache.get(activeChannelId);
            if (channel) {
                const embedDM = new EmbedBuilder().setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() }).setDescription(message.content || '*Arquivo/Imagem*').setColor('#00ff00').setTimestamp();
                const files = message.attachments.map(a => a.url);
                await channel.send({ embeds: [embedDM], files: files });
                await message.react('📨');
            }
            return;
        }
    }

    if (message.guild && client.activeChats.has(message.channel.id)) {
        const targetUserId = client.activeChats.get(message.channel.id);
        const targetUser = await client.users.fetch(targetUserId).catch(() => null);
        if (targetUser) {
            const embedStaff = new EmbedBuilder().setAuthor({ name: `Staff: ${message.author.username}`, iconURL: message.guild.iconURL() }).setDescription(message.content || '*Arquivo/Imagem*').setColor('#ff0000').setTimestamp();
            const files = message.attachments.map(a => a.url);
            try { await targetUser.send({ embeds: [embedStaff], files: files }); await message.react('✅'); } catch (error) { await message.reply('❌ Falha ao enviar DM.'); }
        }
        return;
    }

    // --- LÓGICA DE UPLOAD (ADDJOGO/ADDSOFT) ---
    if (client.tempAddJogoData.has(message.author.id)) {
        const data = client.tempAddJogoData.get(message.author.id);
        if (data.status === 'awaiting_image') {
            const attachment = message.attachments.first();
            if (attachment && attachment.contentType.startsWith('image')) {
                client.tempAddJogoData.delete(message.author.id);
                
                ultimosLancamentos.unshift({ title: data.title, link: data.link, type: data.type });
                if (ultimosLancamentos.length > 5) ultimosLancamentos = ultimosLancamentos.slice(0, 5);
                saveReleases(); 

                await sendGameOrSoftwareEmbed(data.interaction, data.primaryChannelId, data.notificationChannelId, data.title, data.obs, data.link, attachment.url, data.type);
                if (data.waitingMessageId) { try { (await message.channel.messages.fetch(data.waitingMessageId)).delete().catch(()=>{}); } catch (e) {} }
                await message.react('✅').catch(console.error);
                return;
            } else {
                await message.reply({ content: '❌ Envie apenas a imagem.', flags: [MessageFlags.Ephemeral] }).catch(console.error);
            }
        }
    }

    if (!message.content.startsWith(PREFIX)) return;
    if (!message.guild) return message.reply('Use em um servidor.').catch(console.error);

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    const ownerOnly = ['ajogo'];
    if (ownerOnly.includes(command) && message.author.id !== OWNER_ID) return message.reply({ content: '❌ Apenas o dono.' });
    
    if (command === 'ajuda') await handleAjudaPrefix(message);
    else if (command === 'ajogo') await message.reply({ content: 'Use `/dtg addjogo`.', flags: [MessageFlags.Ephemeral] });
    else message.reply(`O comando \`!dtg ${command}\` mudou para barra.`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.guild) { if (interaction.isRepliable()) return interaction.reply({ content: 'Use em servidor.', flags: [MessageFlags.Ephemeral] }); return; }

    if (interaction.isChatInputCommand()) {
        const { commandName, options } = interaction;
        if (commandName === 'dtg') {
            const subcommand = options.getSubcommand();
            const ownerOnly = ['aviso', 'addsoft', 'addjogo', 'limpar', 'addpedido', 'setup_faq', 'config_boasvindas', 'chat'];
            if (ownerOnly.includes(subcommand) && interaction.user.id !== OWNER_ID) return interaction.reply({ content: '❌ Apenas o dono.', flags: [MessageFlags.Ephemeral] });

            if (subcommand === 'ajuda') await handleAjudaSlash(interaction);
            else if (subcommand === 'convite') { 
                 const gifUrl = 'https://media.discordapp.net/attachments/1132735302163779725/1425212324100309084/DTG.gif';
                 const inviteMessage = `**🇧🇷 Quer convidar um amigo?**\nEntre na DownTorrentsGames!\n\n**🇺🇸 Want to invite a friend?**\nJoin DownTorrentsGames!\n\nhttps://discord.gg/uKCrBCNqCT`;
                 await interaction.reply({ content: `${gifUrl}\n\n${inviteMessage}`, ephemeral: false });
            }
            else if (subcommand === 'config_boasvindas') {
                const channel = options.getChannel('canal');
                if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) return interaction.reply({ content: '❌ Canal inválido.', flags: [MessageFlags.Ephemeral] });
                config.welcomeChannelId = channel.id; saveConfig();
                await interaction.reply({ content: `✅ Canal de boas-vindas definido para ${channel}!`, flags: [MessageFlags.Ephemeral] });
            }
            else if (subcommand === 'setup_faq') {
                const embed = new EmbedBuilder().setTitle('❓ Central de Ajuda / Help Center').setDescription('Selecione abaixo o tópico da sua dúvida.\nSelect the topic below.').setColor('#00FF00').setThumbnail(AVISO_GIF_URL);
                const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('open_faq_menu').setLabel('Tirar Dúvidas / Get Help').setStyle(ButtonStyle.Success).setEmoji('💡'));
                await interaction.channel.send({ embeds: [embed], components: [btn] });
                await interaction.reply({ content: '✅ Menu FAQ criado!', flags: [MessageFlags.Ephemeral] });
            }
            else if (subcommand === 'aviso') await handleAvisoChat(interaction);
            // ===============================================
            // NOVO COMANDO: ABRIR CHAT MANUALMENTE
            // ===============================================
            else if (subcommand === 'chat') {
                const targetUser = options.getUser('usuario');
                if (!targetUser) return interaction.reply({ content: '❌ Usuário inválido.', flags: [MessageFlags.Ephemeral] });
                await createChatChannel(interaction, targetUser.id);
            }
            // ===============================================
            else if (subcommand === 'addsoft') { 
                const p = options.getChannel('canal_principal'); const n = options.getChannel('canal_notificacao');
                const m = new ModalBuilder().setCustomId(`addsoft_modal_${p.id}_${n.id}`).setTitle('Add Software');
                m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('addsoft_titulo').setLabel("Título").setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('addsoft_link').setLabel("Link").setStyle(TextInputStyle.Short).setRequired(true)));
                await interaction.showModal(m);
            }
            else if (subcommand === 'addjogo') {
                const p = options.getChannel('canal_principal'); const n = options.getChannel('canal_notificacao');
                const m = new ModalBuilder().setCustomId(`addjogo_modal_${p.id}_${n.id}`).setTitle('Add Jogo');
                m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('addjogo_titulo').setLabel("Título").setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('addjogo_obs').setLabel("Obs").setStyle(TextInputStyle.Paragraph).setRequired(false)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('addjogo_link').setLabel("Link").setStyle(TextInputStyle.Short).setRequired(true)));
                await interaction.showModal(m);
            }
            else if (subcommand === 'limpar') await handleLimparSlash(interaction);
            else if (subcommand === 'addpedido') { 
                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
                const pc = options.getChannel('canal_apresentacao'); const lc = options.getChannel('canal_logs');
                config.presentationChannelId = pc.id; config.logChannelId = lc.id; saveConfig();
                const buttons = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('iniciar_pedido_pt').setLabel('Fazer Pedido!').setStyle(ButtonStyle.Success).setEmoji('🇧🇷'), new ButtonBuilder().setCustomId('iniciar_pedido_en').setLabel('Make Request!').setStyle(ButtonStyle.Primary).setEmoji('🇺🇸'));
                await pc.send({ content: `**🇧🇷 Faça o Pedido:**\n\n**🇺🇸 Make your Request:**\n\nhttps://media.discordapp.net/attachments/1132735302163779725/1425212324100309084/DTG.gif`, components: [buttons] });
                await interaction.editReply({ content: `✅ Configurado!` });
            }
            else if (subcommand === 'pedido' || subcommand === 'order') await sendPedidoInitialEphemeralMessage(interaction, subcommand === 'order');
        }
    }
    else if (interaction.isButton()) {
        if (interaction.customId === 'iniciar_pedido_pt' || interaction.customId === 'iniciar_pedido_en') {
            await sendPedidoInitialEphemeralMessage(interaction, interaction.customId === 'iniciar_pedido_en'); return;
        }
        if (interaction.customId === 'open_faq_menu') {
            const select = new StringSelectMenuBuilder().setCustomId('faq_select').setPlaceholder('Selecione / Select').addOptions(
                new StringSelectMenuOptionBuilder().setLabel('Como Instalar?').setValue('instalar').setEmoji('💿'),
                new StringSelectMenuOptionBuilder().setLabel('Erro de DLL').setValue('dll').setEmoji('⚠️'),
                new StringSelectMenuOptionBuilder().setLabel('Jogar Online?').setValue('online').setEmoji('🌐'),
                new StringSelectMenuOptionBuilder().setLabel('Como Pedir?').setValue('pedido').setEmoji('📦'),
            );
            await interaction.reply({ content: 'Escolha:', components: [new ActionRowBuilder().addComponents(select)], flags: [MessageFlags.Ephemeral] });
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
        else if (interaction.customId.startsWith('start_chat_')) {
            const tId = interaction.customId.split('_')[2];
            await createChatChannel(interaction, tId);
        }
        else if (interaction.customId.startsWith('close_chat_')) {
            const tId = interaction.customId.split('_')[2]; const c = interaction.channel;
            await interaction.reply({ content: '🔒 Fechando...', flags: [MessageFlags.Ephemeral] });
            try {
                const msgs = await c.messages.fetch({ limit: 100 });
                const txt = msgs.reverse().map(m=>`[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}`).join('\n');
                if (config.logChannelId) { const l = await client.channels.fetch(config.logChannelId); if(l) await l.send({ content: `📁 **Backup** <@${tId}>`, files: [{ attachment: Buffer.from(txt), name: `log.txt` }] }); }
                const u = await client.users.fetch(tId).catch(()=>{}); if(u) await u.send('🔒 **Atendimento Encerrado.**').catch(()=>{});
                client.activeChats.delete(tId); client.activeChats.delete(c.id);
                setTimeout(()=>c.delete(), 5000);
            } catch(e){}
        }
        else if (interaction.customId.startsWith('pedido_res|')) {
            if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: '❌ Apenas o dono.', flags: [MessageFlags.Ephemeral] });
            
            const parts = interaction.customId.split('|');
            const action = parts[1];
            const uId = parts[2];
            const gName = parts[3].replace(/_/g, ' '); 
            const plat = parts[4].replace(/_/g, ' '); 
            const online = parts[5].replace(/_/g, ' ');
            const lang = parts[6];

            const isEn = lang === 'en';

            await interaction.deferUpdate();
            let title, body, st;
            
            if (action === 'added') {
                title = isEn ? "CONGRATULATIONS - ADDED!" : "**PARABÉNS - ADICIONADO!**";
                body = isEn ? `Request **${gName} / ${plat}** fulfilled!\n\n` : `Pedido **${gName} / ${plat}** atendido!\n\n`;
                
                if (plat.toLowerCase().includes('pc') || plat.toLowerCase().includes('outros') || plat.toLowerCase().includes('others')) {
                    body += isEn ? `Platform "PC/Software": Check text channel with first letter. Ex: Minecraft -> M.\n\n` : `Plataforma "PC/Software": Verifique o chat com a letra inicial. Ex: Minecraft -> M.\n\n`;
                } else { 
                    body += isEn ? `Console: Check console list.\n\n` : `Console: Verifique a lista do console.\n\n`; 
                }
                
                if (online.toLowerCase().includes('sim') || online.toLowerCase().includes('yes')) { 
                    body += isEn ? `Online: Check CO-OP / ONLINE category.\n\n` : `Online: Verifique a categoria CO-OP / ONLINE.\n\n`; 
                }
                
                body += `**MrGeH**`; 
                st = "Adicionado";
            } else { 
                title = isEn ? "NOTICE" : "**AVISO**"; 
                body = isEn ? `Request **${gName}** rejected (No Crack).\n\n**MrGeH**` : `Pedido **${gName}** não atendido (Sem Crack).\n\n**MrGeH**`; 
                st = "Sem Crack";
            }

            try { 
                const u = await client.users.fetch(uId); 
                await u.send(`${title}\n\n${body}`); 
                
                const dis = new ActionRowBuilder().addComponents(
                    ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true), 
                    ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true), 
                    ButtonBuilder.from(interaction.message.components[0].components[2]).setDisabled(true)
                ); 
                await interaction.message.edit({ components: [dis] }); 
                await interaction.channel.send(`*Resp user (${u.tag}): ${st}*`); 
            } catch(e) { 
                await interaction.followUp({ content: `❌ Falha DM.`, flags: [MessageFlags.Ephemeral] }); 
            }
        }
    }
    else if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'faq_select') {
            const value = interaction.values[0];
            const faq = FAQ_DATA[value];
            if (faq) {
                await interaction.reply({ 
                    content: `**${faq.title}**\n\n${faq.desc}`, 
                    flags: [MessageFlags.Ephemeral] 
                });
            } else {
                await interaction.reply({ content: 'Erro ao buscar FAQ.', flags: [MessageFlags.Ephemeral] });
            }
        }
        else if (interaction.customId.startsWith('pedido_platform_select_') || interaction.customId.startsWith('pedido_online_select_')) {
            const parts = interaction.customId.split('_');
            const userId = parts[3];
            const lang = parts[4];

            if (interaction.user.id !== userId) {
                return interaction.reply({ content: '❌ Este menu não é para você.', flags: [MessageFlags.Ephemeral] });
            }
            let data = client.tempPedidoData.get(userId) || {};
            const selectedValue = interaction.values[0];
            if (interaction.customId.includes('platform')) data.platform = selectedValue;
            else data.online = selectedValue;
            client.tempPedidoData.set(userId, data);
            const canContinue = data.platform && data.online;
            const platformMenu = getPedidoPlatformSelectMenu(userId, lang, data.platform);
            const onlineMenu = getPedidoOnlineSelectMenu(userId, lang, data.online);
            const btnContinue = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`pedido_continue_button_${userId}_${lang}`)
                    .setLabel(lang === 'en' ? 'Continue' : 'Continuar')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(!canContinue) 
            );
            await interaction.update({ components: [platformMenu, onlineMenu, btnContinue] });
        }
    }

    else if (interaction.isModalSubmit()) {
        const { customId, fields } = interaction;
        if (customId.startsWith('pedido_modal_final|')) {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            
            const parts = customId.split('|');
            const userId = parts[1];
            const platform = parts[2];
            const onlineStatus = parts[3];
            const lang = parts[4];

            const isEnglish = lang === 'en';
            
            const nameRaw = fields.getTextInputValue('pedido_game_software_name'); 
            const name = nameRaw.replace(/\|/g, '-'); 
            const link = fields.getTextInputValue('pedido_original_link'); 
            const info = fields.getTextInputValue('pedido_info_msg');
            
            const log = await client.channels.fetch(config.logChannelId);
            
            const logTitle = isEnglish ? '📦 New Request (🇺🇸)' : '📦 Novo Pedido (🇧🇷)';
            const labels = isEnglish 
                ? { user: 'User', name: 'Name', plat: 'Platform', online: 'Online', link: 'Link', info: 'Info' }
                : { user: 'Usuário', name: 'Nome', plat: 'Plataforma', online: 'Online', link: 'Link', info: 'Obs' };

            const embed = new EmbedBuilder()
                .setTitle(logTitle)
                .setColor(getRandomColor())
                .setDescription(`**${labels.user}:** <@${userId}>\n**${labels.name}:** ${name}\n**${labels.plat}:** ${platform}\n**${labels.online}:** ${onlineStatus}\n**${labels.link}:** ${link}\n**${labels.info}:** ${info || '-'}`);
            
            const pSafe = platform.replace(/ /g, '_');
            const oSafe = onlineStatus.replace(/ /g, '_');
            const nSafe = name.replace(/ /g, '_');

            const btns = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`pedido_res|added|${userId}|${nSafe}|${pSafe}|${oSafe}|${lang}`).setLabel(isEnglish ? 'Add' : 'Adicionar').setStyle(ButtonStyle.Success).setEmoji('✅'), 
                new ButtonBuilder().setCustomId(`pedido_res|rejected|${userId}|${nSafe}|${pSafe}|${oSafe}|${lang}`).setLabel(isEnglish ? 'No Crack' : 'Sem Crack').setStyle(ButtonStyle.Danger).setEmoji('❌'), 
                new ButtonBuilder().setCustomId(`start_chat_${userId}`).setLabel('Chat').setStyle(ButtonStyle.Primary).setEmoji('💬')
            );
            
            await log.send({ embeds: [embed], components: [btns] });
            await interaction.editReply({ content: '✅', flags: [MessageFlags.Ephemeral] });
            client.tempPedidoData.delete(userId);
        }
        else if (customId.startsWith('addsoft_modal_') || customId.startsWith('addjogo_modal_')) {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            const isJ = customId.startsWith('addjogo'); const [ , , pId, nId] = customId.split('_');
            const tit = fields.getTextInputValue(isJ?'addjogo_titulo':'addsoft_titulo'); const link = fields.getTextInputValue(isJ?'addjogo_link':'addsoft_link'); const obs = isJ?fields.getTextInputValue('addjogo_obs'):null;
            client.tempAddJogoData.set(interaction.user.id, { status: 'awaiting_image', interaction, primaryChannelId: pId, notificationChannelId: nId, title: tit, obs, link: link, type: isJ?'jogo':'software' });
            const msg = await interaction.editReply({ content: '✅ Mande a IMAGEM.', flags: [MessageFlags.Ephemeral] });
            const d = client.tempAddJogoData.get(interaction.user.id); d.waitingMessageId = msg.id; client.tempAddJogoData.set(interaction.user.id, d);
        }
        else if (customId.startsWith('aviso_modal_')) {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            const [ , , userId, lang ] = customId.split('_'); const avisoTitulo = fields.getTextInputValue('aviso_titulo'); const avisoCorpo = fields.getTextInputValue('aviso_corpo');
            const avisoData = client.tempAvisoData.get(userId);
            
            let finalTitle = `🇧🇷 ${avisoTitulo}`; 
            let finalDescription = avisoCorpo;

            try { 
                const resTitle = await translate(avisoTitulo, { to: 'en' }); 
                const resBody = await translate(avisoCorpo, { to: 'en' }); 
                finalDescription = `${avisoCorpo}\n\n---------------------\n\n🇺🇸 **${resTitle.text}**\n\n${resBody.text}`; 
            } catch (err) {}
            
            const embedAviso = new EmbedBuilder().setTitle(finalTitle).setDescription(finalDescription).setColor(getRandomColor()).setTimestamp().setThumbnail(AVISO_GIF_URL).setFooter({ text: `Aviso por ${interaction.user.username}` });
            for (const channelId of avisoData.channels) { try { const channel = await client.channels.fetch(channelId); if (channel) await channel.send({ content: '@everyone', embeds: [embedAviso] }); } catch (error) {} }
            await interaction.editReply({ content: '✅ Enviado!', flags: [MessageFlags.Ephemeral] });
            client.tempAvisoData.delete(userId);
        }
    }
});

/* FUNÇÕES AUXILIARES */
async function handleAjudaPrefix(m){ await m.reply({ embeds:[new EmbedBuilder().setTitle('Ajuda').setDescription('Use `/dtg`.')] }); }
async function handleAjudaSlash(i){ await i.reply({ embeds:[new EmbedBuilder().setTitle('Ajuda').setDescription('Use `/dtg`.')], flags:[MessageFlags.Ephemeral] }); }
async function handleAvisoChat(interaction) {
    const userId = interaction.user.id; let channels = []; const selCh = interaction.options.getChannel('canal'); 
    if (selCh) channels.push(selCh.id); else channels.push(interaction.channel.id);
    client.tempAvisoData.set(userId, { channels });
    const modal = new ModalBuilder().setCustomId(`aviso_modal_${userId}_pt`).setTitle('Criar Aviso');
    modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('aviso_titulo').setLabel("Título").setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('aviso_corpo').setLabel("Mensagem").setStyle(TextInputStyle.Paragraph).setRequired(true)));
    await interaction.showModal(modal);
}
async function handleLimparSlash(i){ const q = i.options.getInteger('quantidade'); try { await i.channel.bulkDelete(q,true); await i.reply({content:`Apagadas ${q}`,flags:[MessageFlags.Ephemeral]}); } catch(e){ await i.reply({content:'Erro',flags:[MessageFlags.Ephemeral]}); } }

async function handlePedidoModalFinal(i, p, o, isEn) {
    const u = i.user.id; 
    const langCode = isEn ? 'en' : 'pt';
    const safeP = p.replace(/\|/g, ''); 
    const safeO = o.replace(/\|/g, '');

    const m = new ModalBuilder()
        .setCustomId(`pedido_modal_final|${u}|${safeP}|${safeO}|${langCode}`)
        .setTitle(isEn ? 'Request Details' : 'Detalhes do Pedido');

    m.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pedido_game_software_name').setLabel(isEn ? 'Name (Game/Software)' : 'Nome (Jogo/Software)').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pedido_original_link').setLabel('Link').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pedido_info_msg').setLabel(isEn ? 'Extra Info / Observations' : 'Observações / Info Extra').setStyle(TextInputStyle.Paragraph).setRequired(false))
    );
    await i.showModal(m);
}

function getPedidoPlatformSelectMenu(u,l,v){ 
    const o = [{l:'PC',v:'PC'},{l:'OUTROS (Software)',v:'OUTROS (Software)'},{l:'PS1',v:'PS1'},{l:'PS2',v:'PS2'},{l:'PS3',v:'PS3'},{l:'PS4',v:'PS4'},{l:'PS5',v:'PS5'},{l:'XB360',v:'XBOX 360'},{l:'XBONE',v:'XBOX ONE'},{l:'XBS',v:'XBOX SERIES'},{l:'SWITCH',v:'NINTENDO SWITCH'},{l:'3DS',v:'NINTENDO 3DS'},{l:'WII',v:'NINTENDO WII'},{l:'WIIU',v:'NINTENDO WII U'}].map(x=>new StringSelectMenuOptionBuilder().setLabel(x.l).setValue(x.v).setDefault(x.v===v));
    return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`pedido_platform_select_${u}_${l}`).setPlaceholder('Plataforma').addOptions(o));
}
function getPedidoOnlineSelectMenu(u,l,v){ 
    const o = [{l:'Sim',v:'Sim'},{l:'Não',v:'Não'},{l:'Irrelevante (Software)',v:'Irrelevante_Software'}].map(x=>new StringSelectMenuOptionBuilder().setLabel(x.l).setValue(x.v).setDefault(x.v===v));
    return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`pedido_online_select_${u}_${l}`).setPlaceholder('Online?').addOptions(o));
}
async function sendPedidoInitialEphemeralMessage(i,e){
    await i.deferReply({flags:[MessageFlags.Ephemeral]}); const u=i.user.id; const l=e?'en':'pt'; client.tempPedidoData.set(u,{});
    await i.editReply({content:l==='en'?'Select:':'Selecione:',components:[getPedidoPlatformSelectMenu(u,l),getPedidoOnlineSelectMenu(u,l),new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`pedido_continue_button_${u}_${l}`).setLabel(l==='en'?'Continue':'Continuar').setStyle(ButtonStyle.Success).setDisabled(true))]});
}

async function sendGameOrSoftwareEmbed(oi, pid, nid, tit, obs, lnk, img, typ) {
    const mc = await oi.guild.channels.fetch(pid); 
    const nc = await oi.guild.channels.fetch(nid);
    
    const m = await mc.send({ content: `**${tit}**\n\n**Link:** [Clique Aqui! | Click Here!](${lnk})${obs?`\n\nObservação: ${obs}`:''}`, files: img?[{attachment:img,name:'image.png'}]:[] });
    
    const embedTitle = `🎉 Novo ${typ==='jogo'?'Jogo':'Software'}! | New ${typ==='jogo'?'Game':'Software'}!`;

    const emb = new EmbedBuilder()
        .setTitle(embedTitle)
        .setColor(getRandomColor())
        .setDescription(`🇧🇷 Confira o novo ${typ==='jogo'?'jogo':'software'}: **${tit}**\n🇺🇸 Check out the new ${typ==='jogo'?'game':'software'}: **${tit}**`);
    
    if (img) emb.setThumbnail(img);
    
    await nc.send({ content: '@everyone', embeds: [emb], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Clique Aqui para Mais Detalhes! | Click Here for More Details!').setURL(m.url))] });
    
    await oi.editReply({ content: '✅ Sucesso!', flags:[MessageFlags.Ephemeral] });
}

// ==========================================
// NOVA FUNÇÃO: LÓGICA DE CRIAÇÃO DO CHAT
// Usada tanto pelo botão quanto pelo comando /chat
// ==========================================
async function createChatChannel(interaction, tId) {
    if (client.activeChats.has(tId)) {
        return interaction.reply({ content: `⚠️ Já aberto: <#${client.activeChats.get(tId)}>`, flags: [MessageFlags.Ephemeral] });
    }
    
    // Tenta deferir apenas se ainda não foi deferido
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    }

    try {
        const tUser = await client.users.fetch(tId);
        const c = await interaction.guild.channels.create({ 
            name: `chat-${tUser.username}`, 
            type: ChannelType.GuildText, 
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] }, 
                { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }, 
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] } // Quem abriu
            ] 
        });
        
        client.activeChats.set(tId, c.id); 
        client.activeChats.set(c.id, tId);
        
        const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`close_chat_${tId}`).setLabel('Finalizar Chat').setStyle(ButtonStyle.Danger).setEmoji('🔒'));
        await c.send({ content: `👋 Chat com ${tUser} iniciado.`, components: [btn] });
        
        try { 
            await tUser.send(`📩 **Staff do DownTorrentsGames quer falar com você!** Responda por aqui.`); 
        } catch(dmError) { 
            await c.send(`⚠️ DMs bloqueadas pelo usuário.`); 
        }
        
        await interaction.editReply({ content: `✅ Chat criado: ${c}` });
    } catch (error) { 
        console.error(error);
        await interaction.editReply({ content: '❌ Erro ao criar chat.' }); 
    }
}

client.login(TOKEN);