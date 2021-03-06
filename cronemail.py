#!/usr/bin/env python3
import os
import sys
import smtplib
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from email.mime.audio import MIMEAudio
from email.mime.multipart import MIMEMultipart
from email.header import Header
from email.utils import formataddr
from os import listdir
from os.path import isfile, join
import mimetypes

# send voice recordings to email and delete old recordings.

class Recording():
	def __init__(self):
		self.emailSent = False
		
	def sendMultipartEmail(self, sender, recipient, subject, attachFiles, body, bodyFormat):
		msg = MIMEMultipart()
		msg['Subject'] = subject
		#msg['From'] = formataddr((str(Header('MyWebsite', 'utf-8')), 'from@mywebsite.com'))
		msg['From'] = sender
		msg['To'] = recipient
		#msg.preamble = body
		part = None
		if(bodyFormat == 'html'):
			part = MIMEText(body, 'html')
		else:
			part = MIMEText(body, 'plain')

		for f in attachFiles:
			ctype, encoding = mimetypes.guess_type(f)
			if ctype is None or encoding is not None:
				# No guess could be made, or the file is encoded (compressed), so
				# use a generic bag-of-bits type.
				ctype = 'application/octet-stream'
			maintype, subtype = ctype.split('/', 1)
			with open(f, 'rb') as fp:
				img = MIMEAudio(fp.read(), _subtype=subtype)
				img.add_header('Content-Disposition', 'attachment', filename=os.path.basename(fp.name))
				fp.close()
			msg.attach(img)
		s = smtplib.SMTP('mail.robobean.com', 587)
		#s.connect('mail.robobean.com', 587)
		s.starttls()
		s.login('traderbate', 'imjosed1')
		msg.attach(part)
		s.send_message(msg)
		s.quit()
#

def main():
	app = Recording()
	spyEmailSender = "traderbate@mail.robobean.com"
	spyEmailRecipient = "matcha@gmail.com"
	spyEmailSubject = "Voice Recordings"
	
	bodyFormat = "html" #or "plain"
	body = """\
		<html>
		<head></head>
		<body>
			<p>Hi!<br>
			Here is new voice recordings!<br>
			%s<br>
			</p>
			<p>
			More automated communication features at <a href="%s">breve.me</a>.
			</p>
		</body>
		</html>
	"""

	body = body % ("", 'https://breve.me')
	#/uploads/recording.wav
	#gather recordings
	recordings = [f for f in listdir('/home/JosephDietzVEM2/dev/breve/uploads') if isfile(join('/home/JosephDietzVEM2/dev/breve/uploads', f))]
	i = 0
	for name in recordings:
		recordings[i] = "/home/JosephDietzVEM2/dev/breve/uploads/" + name
		i += 1
	if(len(recordings) > 0):
		#print(recordings)
		app.sendMultipartEmail(spyEmailSender, spyEmailRecipient, spyEmailSubject, recordings, body, bodyFormat)
		#delete the recordings
		print(recordings)
		for name1 in recordings:
			os.remove(name1)
	print("Sent and removed")
#

if __name__ == "__main__":
	main()
