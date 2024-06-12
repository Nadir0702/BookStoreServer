const express = require('express');
const winston = require('winston');
const app = express();
app.use(express.json());

const requestLogger = winston.createLogger({
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

const booksLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'DD-MM-YYYY HH:mm:ss.SSS'
        }),
        winston.format.printf(({ timestamp, level, message, requestID  }) => {
            return `${timestamp} ${level.toUpperCase()}: ${message} | request #${requestID}`;
        })
    ),
    transports: [ new winston.transports.File({ filename: 'books.log' })],
});

let responseBody = {}

const genres = ["SCI_FI", "NOVEL", "HISTORY", "MANGA", "ROMANCE", "PROFESSIONAL"];
const levels = "DEBUG,INFO,ERROR";
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
            return false;
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

app.put('/logs/level', (req, res) => {
    entryTimestamp = logRequest(`Incoming request | #${++requestID} | resource: /logs/level | HTTP Verb PUT`);
    let loggerLevel;

    if(levels.includes(req.query["logger-level"])){
        if(req.query["logger-name"] === "request-logger"){
            requestLogger.level = req.query["logger-level"].toLowerCase();
            loggerLevel = requestLogger.level.toUpperCase();
        }
        else if(req.query["logger-name"] === "books-logger"){
            booksLogger.level = req.query["logger-level"].toLowerCase();
            loggerLevel = booksLogger.level.toUpperCase();
        }
        else{
            loggerLevel = `Error: No logger found with the name [${req.query["logger-name"]}]`; 
        }
    }
    else{
        loggerLevel = `Error: [${req.query["logger-level"]}] level does not exist`; 
    }

    if(loggerLevel.length > 5){
        res.status(400).send(loggerLevel);
    }
    else{
        res.status(200).send(loggerLevel);
    }

    requestLogger.debug(`request #${requestID} duration: ${Date.now() - entryTimestamp}ms`, {requestID: requestID});
});

app.get('/logs/level', (req, res) => {
    entryTimestamp = logRequest(`Incoming request | #${++requestID} | resource: /logs/level | HTTP Verb GET`);
    let loggerLevel;

    if(req.query["logger-name"] === "request-logger"){
        loggerLevel = requestLogger.level.toUpperCase();
    }
    else if(req.query["logger-name"] === "books-logger"){
        loggerLevel = booksLogger.level.toUpperCase();
    }
    else{
        loggerLevel = `Error: No logger found with the name [${req.query["logger-name"]}]`; 
    }

    if(loggerLevel.length > 5){
        res.status(400).send(loggerLevel);
    }
    else{
        res.status(200).send(loggerLevel);
    }
    
    requestLogger.debug(`request #${requestID} duration: ${Date.now() - entryTimestamp}ms`, {requestID: requestID});
});

app.delete('/book', (req, res) => {
    entryTimestamp = logRequest(`Incoming request | #${++requestID} | resource: /book | HTTP Verb DELETE`);
    const id = Number(req.query.id);
    let bookToDeleteIndex;

    responseBody.errorMessage = undefined;
    responseBody.result = undefined;

    bookToDeleteIndex = binarySearch(books, id);
    if(bookToDeleteIndex !== NOT_FOUND){
        booksLogger.info(`Removing book [${books[bookToDeleteIndex].title}]`, {requestID: requestID});
        booksLogger.debug(`After removing book [${books[bookToDeleteIndex].title}] id: [${id}] there are ${numOfBooks - 1} books in the system`, {requestID: requestID});
        books.splice(bookToDeleteIndex, 1);
        responseBody.result = --numOfBooks;
        res.status(200).json(responseBody);
    }
    else{
        responseBody.errorMessage = `Error: no such Book with id ${id}`;
        booksLogger.error(responseBody.errorMessage, {requestID: requestID});
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
        booksLogger.info(`Update Book id [${bookToFind.id}] price to ${price}`, {requestID: requestID});
        booksLogger.debug(`Book [${bookToFind.title}] price change: ${bookToFind.price} --> ${price}`, {requestID: requestID});
        responseBody.result = Number(bookToFind.price);
        books[id - 1].price = price;
        res.status(200).json(responseBody);
    }

    if(responseBody.errorMessage != undefined){
        booksLogger.error(responseBody.errorMessage, {requestID: requestID});
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
        booksLogger.debug(`Fetching book id ${bookToFind.id} details`, {requestID: requestID});
        responseBody.result = bookToFind;
        res.status(200).json(responseBody);
    }
    else{
        responseBody.errorMessage = `Error: no such Book with id ${id}`;
        res.status(404).json(responseBody); 
        booksLogger.error(responseBody.errorMessage, {requestID: requestID});
    }

    requestLogger.debug(`request #${requestID} duration: ${Date.now() - entryTimestamp}ms`, {requestID: requestID});
});

app.get('/books', (req, res) => {
    entryTimestamp = logRequest(`Incoming request | #${++requestID} | resource: /books | HTTP Verb GET`);
    let filteredBooks = [];

    responseBody.errorMessage = undefined;
    responseBody.result = undefined;

    filteredBooks = filterBooks(req);
    if(filteredBooks == false){
        responseBody.errorMessage = `Error: invalid genres`;
        requestLogger.debug(`request #${requestID} duration: ${Date.now() - entryTimestamp}ms`, {requestID: requestID});
        return res.status(400).json(responseBody);
    }

    booksLogger.info(`Total Books found for requested filters is ${filteredBooks.length}`, {requestID: requestID});
    responseBody.result = filteredBooks.sort((first, second) => 
        first.title.toLowerCase().localeCompare(second.title.toLowerCase()));

    res.status(200).json(responseBody);
    requestLogger.debug(`request #${requestID} duration: ${Date.now() - entryTimestamp}ms`, {requestID: requestID});
});

app.get('/books/total', (req, res) => {
    entryTimestamp = logRequest(`Incoming request | #${++requestID} | resource: /books/total | HTTP Verb GET`);
    let filteredBooks;

    responseBody.errorMessage = undefined;
    responseBody.result = undefined;

    filteredBooks = filterBooks(req);
    if(filteredBooks === false){
        responseBody.errorMessage = `Error: invalid genres`;
        requestLogger.debug(`request #${requestID} duration: ${Date.now() - entryTimestamp}ms`, {requestID: requestID});
        return res.status(400).json(responseBody);
    }

    responseBody.result = filteredBooks.length;
    booksLogger.info(`Total Books found for requested filters is ${responseBody.result}`, {requestID: requestID})

    res.status(200).json(responseBody);
    requestLogger.debug(`request #${requestID} duration: ${Date.now() - entryTimestamp}ms`, {requestID: requestID});
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
        booksLogger.info(`Creating new Book with Title [${book.title}]`, {requestID: requestID});
        booksLogger.debug(`Currently there are ${numOfBooks} Books in the system. New Book will be assigned with id ${nextID}`, {requestID: requestID});
        book.id = nextID; 
        book = JSON.parse(JSON.stringify(book, ["id", "title", "author", "price", "year", "genres"], 4));
        books.push(book);
        numOfBooks++;
        nextID++;
        responseBody.result = book.id;
        requestLogger.debug(`request #${requestID} duration: ${Date.now() - entryTimestamp}ms`, {requestID: requestID});
        return res.status(200).json(responseBody);
    }

    booksLogger.error(responseBody.errorMessage, {requestID: requestID});
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
