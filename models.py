from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone, timedelta

db = SQLAlchemy()

def get_hkt():
    return datetime.now(timezone(timedelta(hours=8)))

class Canvas(db.Model):
    __tablename__ = 'canvases'
    id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime, default=get_hkt)
    
    # Relationship: This creates a virtual 'shapes' property on Canvas objects
    # 'backref' adds a virtual 'canvas' property to GenerativeShape objects
    shapes = db.relationship('GenerativeShape', backref='canvas', lazy=True)
    thoughts = db.relationship('Thought', backref='canvas', lazy=True)

    
class GenerativeShape(db.Model):
    __tablename__ = 'generative_shapes'

    id = db.Column(db.Integer, primary_key=True)
    
    # Foreign Key: Links this shape to a specific Canvas ID
    canvas_id = db.Column(db.Integer, db.ForeignKey('canvases.id'), nullable=False)

    pos = db.Column(db.JSON, nullable=False)
    color = db.Column(db.JSON, nullable=False)
    thickness = db.Column(db.Float, nullable=False)
    growth = db.Column(db.Float, nullable=False)
    turns = db.Column(db.Float, nullable=False)

    def __repr__(self):
        return f"Shape #{self.id}"  
    
class Thought(db.Model):
    __tablename__ = 'thoughts'
    id = db.Column(db.Integer, primary_key=True)
    canvas_id = db.Column(db.Integer, db.ForeignKey('canvases.id'), nullable=False)
    text = db.Column(db.String(500), nullable=False)
    # Store location as JSON [x, y] to match your spiral logic
    location = db.Column(db.JSON, nullable=False) 