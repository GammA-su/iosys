const path = require('path');
const express = require('express');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;

app.disable('x-powered-by');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(ROOT_DIR));

function asBoolean(value) {
	if (typeof value !== 'string') return false;
	return value.toLowerCase() === 'true';
}

function clean(value) {
	return String(value || '').trim();
}

function escHtml(value) {
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function isValidEmail(email) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function smtpConfigFromEnv() {
	const host = clean(process.env.SMTP_HOST);
	const user = clean(process.env.SMTP_USER);
	const pass = clean(process.env.SMTP_PASS);
	const port = Number(process.env.SMTP_PORT || 587);
	const secure = asBoolean(process.env.SMTP_SECURE) || port === 465;

	if (!host || !user || !pass || Number.isNaN(port)) {
		return null;
	}

	return {
		host,
		port,
		secure,
		auth: { user, pass },
	};
}

app.post('/api/contact', async (req, res) => {
	const prefix = clean(req.body.prefix) || 'template-contactform-';
	const honeypotKey = `${prefix}botcheck`;

	if (clean(req.body[honeypotKey])) {
		return res.json({
			alert: 'error',
			message: 'Bot detecte. Formulaire refuse.',
		});
	}

	const name = clean(req.body[`${prefix}name`]);
	const email = clean(req.body[`${prefix}email`]);
	const subject = clean(req.body.subject) || 'Nouveau message depuis le site IOSYS';
	const message = clean(req.body[`${prefix}message`]);

	if (!name || !email || !message || !isValidEmail(email)) {
		return res.json({
			alert: 'error',
			message: 'Merci de remplir correctement le nom, l email et le message.',
		});
	}

	const smtpConfig = smtpConfigFromEnv();
	if (!smtpConfig) {
		return res.json({
			alert: 'error',
			message: 'SMTP non configure sur le serveur. Contactez l administrateur.',
		});
	}

	const toEmail = clean(process.env.CONTACT_TO_EMAIL) || smtpConfig.auth.user;
	const fromEmail = clean(process.env.CONTACT_FROM_EMAIL) || smtpConfig.auth.user;
	const fromName = clean(process.env.CONTACT_FROM_NAME) || 'IOSYS';

	const transporter = nodemailer.createTransport(smtpConfig);
	const htmlMessage = `
		<h2>Nouveau message depuis le site IOSYS</h2>
		<p><strong>Nom:</strong> ${escHtml(name)}</p>
		<p><strong>Email:</strong> ${escHtml(email)}</p>
		<p><strong>Sujet:</strong> ${escHtml(subject)}</p>
		<p><strong>Message:</strong><br>${escHtml(message).replace(/\n/g, '<br>')}</p>
	`;

	try {
		await transporter.sendMail({
			to: toEmail,
			from: `"${fromName}" <${fromEmail}>`,
			replyTo: email,
			subject,
			text: `Nom: ${name}\nEmail: ${email}\nSujet: ${subject}\n\nMessage:\n${message}`,
			html: htmlMessage,
		});

		return res.json({
			alert: 'success',
			message: 'Message envoye avec succes. Nous vous repondrons rapidement.',
		});
	} catch (error) {
		return res.json({
			alert: 'error',
			message: `Echec de l envoi du message. ${escHtml(error.message || 'Erreur SMTP.')}`,
		});
	}
});

app.get('*', (req, res) => {
	res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

app.listen(PORT, () => {
	console.log(`IOSYS server running on port ${PORT}`);
});
