from flask import Flask, request, jsonify
from pytrends.request import TrendReq
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Optional: enables CORS if you're calling from frontend

def get_trending_keywords(keywords, timeframe='now 7-d'):
    pytrends = TrendReq()
    pytrends.build_payload(keywords, timeframe=timeframe)
    related_queries = pytrends.related_queries()

    # Convert DataFrames to dicts
    output = {}
    for kw, data in related_queries.items():
        output[kw] = {
            'top': data['top'].to_dict(orient='records') if data['top'] is not None else [],
            'rising': data['rising'].to_dict(orient='records') if data['rising'] is not None else []
        }
    return output

@app.route('/trends', methods=['GET'])
def trends():
    # You can pass keywords as comma-separated list, e.g., ?keywords=AI,ChatGPT
    keyword_str = request.args.get('keywords', 'AI,ChatGPT')
    keywords = [kw.strip() for kw in keyword_str.split(',')]
    timeframe = request.args.get('timeframe', 'now 7-d')

    try:
        result = get_trending_keywords(keywords, timeframe)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=3333)
