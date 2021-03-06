const { Show } = require("../../../models/Show");
const { Theater } = require("../../../models/Theater");
const { Movie } = require("../../../models/Movie");
const { Ticket } = require("../../../models/Ticket");
const Promise = require("bluebird");

const getShows = async (req, res) => {
    const { theaterId, movieId, movie, theater } = req.query;

    if (movie && theater) {
        const theaterRe = new RegExp(theater);
        const movieRe = new RegExp(movie);
        const shows = await Show.find({
            "theater.name": theaterRe,
            "movie.name": movieRe,
        }).select("-tickets");

        shows.forEach(
            (show, i) =>
                (shows[i] = {
                    ...show.transform(),
                    movie: show.movie.transform(),
                    theater: show.theater.transform(),
                })
        );

        return res.status(200).json(shows);
    }

    if (theaterId) {
        const shows = await Show.find().where("theater._id").eq(theaterId).select("-tickets");
        const movies = await Show.find().where("theater._id").eq(theaterId).distinct("movie");

        shows.forEach((show, index) => {
            const transformedGenres = shows[index].movie.genres.map((g) => g.transform());

            shows[index] = {
                ...show.transform(),
                movie: {
                    ...show.movie.transform(),
                    genres: transformedGenres,
                },
                theater: show.theater.transform(),
            };
        });
        movies.forEach((movie, index) => {
            movies[index].genres.forEach((g, j) => {
                movies[index].genres[j].id = g._id;
                delete movies[index].genres[j]._id;
                delete movies[index].genres[j].__v;
            });
            movies[index].id = movie._id;
            delete movies[index]._id;
            delete movies[index].__v;
        });

        return res.status(200).json({
            shows,
            movies,
        });
    }

    if (movieId) {
        const shows = await Show.find().where("movie._id").eq(movieId).select("-tickets");
        const theaters = await Show.find().where("movie._id").eq(movieId).distinct("theater");

        shows.forEach(
            (show, index) =>
                (shows[index] = {
                    ...show.transform(),
                    movie: show.movie.transform(),
                    theater: show.theater.transform(),
                })
        );
        theaters.forEach((theater, index) => {
            theaters[index].id = theater._id;
            delete theaters[index]._id;
        });

        return res.status(200).json({
            shows,
            theaters,
        });
    }

    const shows = await Show.find().select(["startTime", "theater", "movie"]);

    shows.forEach((show, i) => {
        const transformedGenres = show.movie.genres.map((genre, j) => (show.movie.genres[j] = genre.transform()));

        shows[i] = {
            ...show.transform(),
            movie: {
                ...show.movie.transform(),
                genres: transformedGenres,
            },
            theater: show.theater.transform(),
        };
    });

    return res.status(200).json(shows);
};

const createShow = async (req, res) => {
    const { theaterId, movieId, startTime } = req.body;
    const theater = await Theater.findById(theaterId);
    const movie = await Movie.findById(movieId);
    const tickets = [];

    for (let i = 0; i < 8; i++) {
        const rowOfSeat = String.fromCharCode(i + 65);
        for (let j = 1; j < 9; j++) {
            tickets.push(
                new Ticket({
                    seat: rowOfSeat + j,
                })
            );
        }
    }

    try {
        await Promise.map(tickets, function (ticket) {
            return ticket.save();
        });
        let show = new Show({
            theater,
            movie,
            tickets,
        });
        await show.save();

        show.movie.genres.forEach((genre, i) => (show.movie.genres[i] = genre.transform()));
        show.tickets.forEach((ticket, i) => (show.tickets[i] = ticket.transform()));

        return res.status(201).json({
            movie: show.movie.transform(),
            theater: show.theater.transform(),
            startTime: startTime && startTime,
            numberOfTickets: tickets.length,
            ...show.transform(),
        });
    } catch (error) {
        return res.status(500).json(error);
    }
};

module.exports = {
    getShows,
    createShow,
};
