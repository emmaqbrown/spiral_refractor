# to run the server: 
# python app.py

from flask import Flask, request, url_for, request, redirect, render_template, jsonify
from flask_sqlalchemy import SQLAlchemy
from collections import defaultdict
from werkzeug.middleware.proxy_fix import ProxyFix
import logging
from datetime import datetime, timezone, timedelta
from models import *

app = Flask(__name__)

app.wsgi_app = ProxyFix(app.wsgi_app, x_for=2)

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = "sqlite:///database.db"
db.init_app(app)


# Create tables
with app.app_context():
    db.create_all()


# 2. Configure the logger (Optional: customize the format)
logging.basicConfig(level=logging.INFO)


@app.before_request
def log_request_info():
    # This will run before every single request
    # Since we used ProxyFix, request.remote_addr is the REAL visitor IP
    app.logger.info('--- Incoming Request ---')
    app.logger.info(f"Date and Time (HKT): {datetime.now(timezone(timedelta(hours=8))).strftime('%Y-%m-%d %H:%M:%S')}")
    app.logger.info(f"Real IP: {request.remote_addr}")
    app.logger.info(f"Path: {request.path}")
    app.logger.info(f"User Agent: {request.headers.get('User-Agent')}")
# --- ROUTES ---
@app.route("/", methods=['GET'])
def index():
    return render_template('index.html')

@app.route("/save-canvas", methods=['POST'])
def save_canvas():
    data = request.json  # This will be the SPIRAL_DATA array from JS
    
    # 1. Create the Canvas parent
    new_canvas = Canvas()
    
    # 2. Loop through the 4 shapes sent from JS
    for s in data:
        shape = GenerativeShape(
            pos=s['pos'],
            color=s['color'],
            thickness=s['thickness'],
            growth=s['growth'],
            turns=s['turns']
        )
        new_canvas.shapes.append(shape)
    
    db.session.add(new_canvas)
    db.session.commit()
    
    return jsonify({"status": "success", "canvas_id": new_canvas.id}), 201

@app.route("/save-thought", methods=['POST'])
def save_thought():
    data = request.json
    # Expecting: { "canvas_id": 1, "text": "...", "location": [x, y] }
    
    new_thought = Thought(
        canvas_id=data['canvas_id'],
        text=data['text'],
        location=data['location']
    )
    
    db.session.add(new_thought)
    db.session.commit()

    print('save thought')
    
    return jsonify({"status": "success"}), 201

@app.route("/canvas/<int:canvas_id>")
def view_canvas(canvas_id):
    # Fetch the canvas or return 404 if it doesn't exist
    canvas = Canvas.query.get_or_404(canvas_id)
    
    # Prepare the shapes data for the frontend
    shapes_data = []
    for s in canvas.shapes:
        shapes_data.append({
            "pos": s.pos,
            "color": s.color,
            "thickness": s.thickness,
            "growth": s.growth,
            "turns": s.turns
        })
    print(canvas.shapes)
    print(canvas.thoughts)
    # Prepare the thoughts data
    thoughts_data = []
    for t in canvas.thoughts:
        thoughts_data.append({
            "text": t.text,
            "location": t.location
        })

    return render_template(
        'canvas.html',
        saved_shapes=shapes_data,
        saved_thoughts=thoughts_data,
        is_view_only=True,
        canvas_id = canvas.id
    )

if __name__ == '__main__': 
    app.run(debug=True, host="0.0.0.0", port=5000)
