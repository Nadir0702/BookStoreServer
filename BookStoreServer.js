const express = require('express');
const winston = require('winston');
const app = express();
app.use(express.json());

const requestLogger = winston.createLogger({
    name: 'request-logger',
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'DD-MM-YYYY HH:mm:ss.SSS'
        }),
        winston.format.printf(({ timestamp, level, message, requestID  }) => {
            return `${timestamp} ${level.toUpperCase()}: ${message} | request #${requestID}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'requests.log' })
    ],
});

const logRequest = (message) => {
    const timestamp = Date.now();
    requestLogger.info(message, { requestID });
    return timestamp;
};

let responseBody = {}

const genres = ["SCI_FI", "NOVEL", "HISTORY", "MANGA", "ROMANCE", "PROFESSIONAL"];
const NOT_FOUND = -1;
const MIN_YEAR = 1940;
const MAX_YEAR = 2100;
const MIN_PRICE = 1;
const MAX_PRICE = Number.MAX_SAFE_INTEGER;
let entryTimestamp;
let numOfBooks = 0;
let requestID = 0;
let nextID = 1;
let books = [];

function isEqual(str1, str2){
    str1 = str1.toLowerCase();
    str2 = str2.toLowerCase();
    return str1 === str2;
}

function isExistingTitle(book){
    result = false;
    for(let currBook of books){
        if(isEqual(currBook.title, book.title)){          
            result = true;
        }
    }
    return result;
}

function isYearValid(book, minYear = MIN_YEAR, maxYear = MAX_YEAR){
    return book.year <= maxYear && book.year >= minYear;
}

function isPriceValid(book, minPrice = MIN_PRICE, maxPrice = MAX_PRICE){
    return book.price <= maxPrice && book.price >= minPrice;
}

function filterBooks(req){
    let filteredBooks = books;

    if(req.query.author != undefined){
        filteredBooks = filteredBooks.filter((book) => isEqual(book.author, req.query.author));
    }

    if(req.query["price-bigger-than"] != undefined){
        filteredBooks = filteredBooks.filter((book) => isPriceValid(book, req.query["price-bigger-than"]));
    }

    if(req.query['price-less-than'] != undefined){
        filteredBooks = filteredBooks.filter((book) => isPriceValid(book, MIN_PRICE, req.query['price-less-than']));
    }

    if(req.query['year-bigger-than'] != undefined){
        filteredBooks = filteredBooks.filter((book) => isYearValid(book, req.query['year-bigger-than']));
    }

    if(req.query['year-less-than'] != undefined){
        filteredBooks = filteredBooks.filter((book) => isYearValid(book, MIN_YEAR, req.query['year-less-than']));
    }

    if(req.query.genres != undefined){
        let genres = req.query.genres;

        if(genres.toUpperCase() != genres){
            responseBody.errorMessage = 'Error: Invalid Genres'
            return res.status(400).json(responseBody);
        }

        filteredBooks = filteredBooks.filter((book) => {
            for(let currGenre of book.genres){
                if(genres.includes(currGenre)){
                    return true;
                }
            }
            return false;
        });
    }

    return filteredBooks;
}

function binarySearch(array, target) {
    let left = 0;
    let right = array.length - 1;

    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        if (array[mid].id === target) {
            return mid;
        }

        if (array[mid].id < target) {
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }

    return NOT_FOUND;
}


app.delete('/book', (req, res) => {
    entryTimestamp = logRequest(`Incoming request | #${++requestID} | resource: /book | HTTP Verb DELETE`);
    const id = Number(req.query.id);
    let bookToDeleteIndex;

    responseBody.errorMessage = undefined;
    responseBody.result = undefined;

    bookToDeleteIndex = binarySearch(books, id);
    if(bookToDeleteIndex !== NOT_FOUND){
        books.splice(bookToDeleteIndex, 1);
        responseBody.result = --numOfBooks;
        res.status(200).json(responseBody);
    }
    else{
        responseBody.errorMessage = `Error: no such Book with id ${id}`;
        res.status(404).json(responseBody); 
    }

    requestLogger.debug(`request #${requestID} duration: ${Date.now() - entryTimestamp}ms`, {requestID: requestID});
});

app.put('/book', (req, res) => {
    entryTimestamp = logRequest(`Incoming request | #${++requestID} | resource: /book | HTTP Verb PUT`);

    const id = Number(req.query.id);
    const price = Number(req.query.price);
    let bookToFind = books[id - 1];

    responseBody.errorMessage = undefined;
    responseBody.result = undefined;

    if(bookToFind === undefined){
        responseBody.errorMessage = `Error: no such Book with id ${id}`;
        res.status(404).json(responseBody); 
    }
    else if(price < 0){
        responseBody.errorMessage = `Error: price update for book [${id}] must be a positive integer`;
        res.status(409).json(responseBody);
    }
    else{
        responseBody.result = Number(bookToFind.price);
        books[id - 1].price = price;
        res.status(200).json(responseBody);
    }

    requestLogger.debug(`request #${requestID} duration: ${Date.now() - entryTimestamp}ms`, {requestID: requestID});
});

app.get('/book', (req, res) => {
    entryTimestamp = logRequest(`Incoming request | #${++requestID} | resource: /book | HTTP Verb GET`);

    const id = Number(req.query.id);
    let bookToFind = books[id - 1];

    responseBody.errorMessage = undefined;
    responseBody.result = undefined;

    if(bookToFind != undefined){
        responseBody.result = bookToFind;
        res.status(200).json(responseBody);
    }
    else{
        responseBody.errorMessage = `Error: no such Book with id ${id}`;
        res.status(404).json(responseBody); 
    }

    requestLogger.debug(`request #${requestID} duration: ${Date.now() - entryTimestamp}ms`, {requestID: requestID});
});

app.get('/books', (req, res) => {
    entryTimestamp = logRequest(`Incoming request | #${++requestID} | resource: /books | HTTP Verb GET`);
    let filteredBooks = [];

    responseBody.errorMessage = undefined;
    responseBody.result = undefined;

    filteredBooks = filterBooks(req);

    responseBody.result = filteredBooks.sort((first, second) => 
        first.title.toLowerCase().localeCompare(second.title.toLowerCase()));

    requestLogger.debug(`request #${requestID} duration: ${Date.now() - entryTimestamp}ms`, {requestID: requestID});
    res.status(200).json(responseBody);
});

app.get('/books/total', (req, res) => {
    entryTimestamp = logRequest(`Incoming request | #${++requestID} | resource: /books/total | HTTP Verb GET`);
    let filteredBooks;

    responseBody.errorMessage = undefined;
    responseBody.result = undefined;

    filteredBooks = filterBooks(req);

    responseBody.result = filteredBooks.length;

    requestLogger.debug(`request #${requestID} duration: ${Date.now() - entryTimestamp}ms`, {requestID: requestID});
    res.status(200).json(responseBody);
});

app.post('/book', (req, res) => {
    entryTimestamp = logRequest(`Incoming request | #${++requestID} | resource: /book | HTTP Verb POST`);
    let book = req.body;

    responseBody.errorMessage = undefined;
    responseBody.result = undefined;

    if(isExistingTitle(book)){
        responseBody.errorMessage = `Error: Book with the title [${book.title}] already exists in the system`;
    }
    else if(!isYearValid(book)){
        responseBody.errorMessage = `Error: Can’t create new Book that its year [${book.year}] is not in the accepted range [1940 -> 2100]`;
    }
    else if(!isPriceValid(book)){
        responseBody.errorMessage = `Error: Can’t create new Book with negative price`;
    }
    else{
        book.id = nextID; 
        book = JSON.parse(JSON.stringify(book, ["id", "title", "author", "price", "year", "genres"], 4));
        books.push(book);
        numOfBooks++;
        nextID++;
        responseBody.result = book.id;
        requestLogger.debug(`request #${requestID} duration: ${Date.now() - entryTimestamp}ms`, {requestID: requestID});
        return res.status(200).json(responseBody);
    }

    requestLogger.debug(`request #${requestID} duration: ${Date.now() - entryTimestamp}ms`, {requestID: requestID});
    return res.status(409).json(responseBody);
});

app.get('/books/health', (req, res) => {
    entryTimestamp = logRequest(`Incoming request | #${++requestID} | resource: /books/health | HTTP Verb GET`, 'info');
    res.status(200).send('ok');
    requestLogger.debug(`request #${requestID} duration: ${Date.now() - entryTimestamp}ms`, {requestID: requestID});
});

// Start the server
const port = 8574;
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
