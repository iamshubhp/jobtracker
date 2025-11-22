from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from flask_bcrypt import Bcrypt
from pymongo import MongoClient
from bson.objectid import ObjectId
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv(
    'SECRET_KEY', 'dev-secret-key-change-in-production')

# MongoDB setup
MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/')
client = MongoClient(MONGODB_URI)
db = client['jobtracker']
users_collection = db['users']
applications_collection = db['applications']

# Flask-Login setup
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Bcrypt for password hashing
bcrypt = Bcrypt(app)

# User class


class User(UserMixin):
    def __init__(self, user_data):
        self.id = str(user_data['_id'])
        self.email = user_data['email']
        self.name = user_data['name']


@login_manager.user_loader
def load_user(user_id):
    user_data = users_collection.find_one({'_id': ObjectId(user_id)})
    if user_data:
        return User(user_data)
    return None

# Routes


@app.route('/')
def index():
    if current_user.is_authenticated:
        return render_template('index.html')
    return redirect(url_for('login'))


@app.route('/login')
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    return render_template('login.html')


@app.route('/signup')
def signup():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    return render_template('signup.html')

# API Routes


@app.route('/api/signup', methods=['POST'])
def api_signup():
    data = request.json

    # Validate input
    if not data.get('email') or not data.get('password') or not data.get('name'):
        return jsonify({'error': 'All fields are required'}), 400

    # Check if user already exists
    if users_collection.find_one({'email': data['email'].lower()}):
        return jsonify({'error': 'Email already registered'}), 400

    # Validate password strength
    if len(data['password']) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400

    # Hash password
    hashed_password = bcrypt.generate_password_hash(
        data['password']).decode('utf-8')

    # Create user
    user_data = {
        'email': data['email'].lower(),
        'password': hashed_password,
        'name': data['name'],
        'created_at': datetime.utcnow()
    }

    result = users_collection.insert_one(user_data)

    # Log user in
    user = User({'_id': result.inserted_id,
                'email': user_data['email'], 'name': user_data['name']})
    login_user(user)

    return jsonify({'message': 'Account created successfully'}), 201


@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.json

    if not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password required'}), 400

    # Find user
    user_data = users_collection.find_one({'email': data['email'].lower()})

    if not user_data or not bcrypt.check_password_hash(user_data['password'], data['password']):
        return jsonify({'error': 'Invalid email or password'}), 401

    # Log user in
    user = User(user_data)
    login_user(user, remember=data.get('remember', False))

    return jsonify({'message': 'Login successful', 'name': user.name}), 200


@app.route('/api/logout', methods=['POST'])
@login_required
def api_logout():
    logout_user()
    return jsonify({'message': 'Logged out successfully'}), 200


@app.route('/api/user', methods=['GET'])
@login_required
def get_user():
    return jsonify({
        'id': current_user.id,
        'email': current_user.email,
        'name': current_user.name
    })


@app.route('/api/applications', methods=['GET'])
@login_required
def get_applications():
    # Get only current user's applications
    applications = list(applications_collection.find(
        {'user_id': current_user.id}).sort('date_applied', -1))

    # Convert ObjectId to string
    for app in applications:
        app['_id'] = str(app['_id'])

    return jsonify(applications)


@app.route('/api/applications', methods=['POST'])
@login_required
def add_application():
    data = request.json

    application = {
        'user_id': current_user.id,
        'company': data['company'],
        'position': data['position'],
        'status': data.get('status', 'Applied'),
        'date_applied': data.get('date_applied', datetime.now().strftime('%Y-%m-%d')),
        'notes': data.get('notes', ''),
        'job_url': data.get('job_url', ''),
        'salary': data.get('salary', ''),
        'location': data.get('location', ''),
        'created_at': datetime.utcnow()
    }

    result = applications_collection.insert_one(application)

    return jsonify({'id': str(result.inserted_id), 'message': 'Application added successfully'}), 201


@app.route('/api/applications/<app_id>', methods=['PUT'])
@login_required
def update_application(app_id):
    data = request.json

    # Verify ownership
    app = applications_collection.find_one(
        {'_id': ObjectId(app_id), 'user_id': current_user.id})
    if not app:
        return jsonify({'error': 'Application not found'}), 404

    applications_collection.update_one(
        {'_id': ObjectId(app_id)},
        {'$set': {
            'company': data['company'],
            'position': data['position'],
            'status': data['status'],
            'date_applied': data['date_applied'],
            'notes': data.get('notes', ''),
            'job_url': data.get('job_url', ''),
            'salary': data.get('salary', ''),
            'location': data.get('location', ''),
            'updated_at': datetime.utcnow()
        }}
    )

    return jsonify({'message': 'Application updated successfully'})


@app.route('/api/applications/<app_id>', methods=['DELETE'])
@login_required
def delete_application(app_id):
    # Verify ownership
    result = applications_collection.delete_one(
        {'_id': ObjectId(app_id), 'user_id': current_user.id})

    if result.deleted_count == 0:
        return jsonify({'error': 'Application not found'}), 404

    return jsonify({'message': 'Application deleted successfully'})


@app.route('/api/stats', methods=['GET'])
@login_required
def get_stats():
    # Get stats for current user only
    pipeline = [
        {'$match': {'user_id': current_user.id}},
        {'$group': {
            '_id': '$status',
            'count': {'$sum': 1}
        }}
    ]

    status_counts = list(applications_collection.aggregate(pipeline))
    total = applications_collection.count_documents(
        {'user_id': current_user.id})

    by_status = {item['_id']: item['count'] for item in status_counts}

    return jsonify({
        'total': total,
        'by_status': by_status
    })


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
