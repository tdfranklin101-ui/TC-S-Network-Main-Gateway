
from flask import Flask, request, render_template_string
import csv
import os

app = Flask(__name__)
REGISTRANT_FILE = "registrants.csv"

@app.route("/signup", methods=["POST"])
def signup():
    name = request.form.get("name")
    email = request.form.get("email")
    if name and email:
        file_exists = os.path.isfile(REGISTRANT_FILE)
        with open(REGISTRANT_FILE, "a", newline="") as csvfile:
            writer = csv.writer(csvfile)
            if not file_exists:
                writer.writerow(["Name", "Email"])
            writer.writerow([name, email])
        return render_template_string("<h2>Thank you for signing up, {{name}}!</h2>", name=name)
    return "Missing name or email", 400

@app.route("/registrants/count", methods=["GET"])
def count():
    if not os.path.exists(REGISTRANT_FILE):
        return {"count": 0}
    with open(REGISTRANT_FILE) as f:
        return {"count": sum(1 for row in f) - 1}

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000)
