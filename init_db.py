# To create your database: python init_db.py
#   creates database at /instance/project.db 

from flask import Flask
from models import *

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = "sqlite:///riddles.db"
db.init_app(app)
