/// <reference types="cypress" />

describe('Testes da Funcionalidade Catálogo de Livros', () => {

let token
beforeEach(() => {
    cy.geraToken('admin@biblioteca.com', 'admin123').then(tkn => {
        token = tkn
    })
});

    // Objetivo: Verificar que a API retorna lista de livros com paginação e filtros funcionando
    // Validar que filtros por categoria e autores funcionam corretamente
    it('GET - Deve listar livros com filtros e paginação', () => {
        // Filtro por categoria + paginação
        cy.api({
            method: 'GET',
            url: 'books',
            qs: {
                category: 'Ficção Clássica',
                limit: 5,
                page: 1
            }
        }).should(response => {
            expect(response.status).to.equal(200)
            expect(response.body).to.have.property('books')
            expect(response.body.books).to.be.an('array')
            expect(response.body.books.length).to.be.at.most(5)

            // Todo livro retornado deve pertencer à categoria filtrada
            response.body.books.forEach(book => {
                expect(book.category).to.equal('Ficção Clássica')
            })

            // Estrutura da paginação
            expect(response.body).to.have.property('pagination')
            expect(response.body.pagination).to.have.property('total')
            expect(response.body.pagination.limit).to.equal(5)
            expect(response.body.pagination.currentPage).to.equal(1)
            expect(response.body.pagination).to.have.property('totalPages')

            // Os filtros aplicados devem ser ecoados na resposta
            expect(response.body.filters.category).to.equal('Ficção Clássica')
        })

        // Filtro por autor
        cy.api({
            method: 'GET',
            url: 'books',
            qs: { author: 'Machado de Assis' }
        }).should(response => {
            expect(response.status).to.equal(200)
            expect(response.body.books).to.be.an('array')
            response.body.books.forEach(book => {
                expect(book.author).to.contain('Machado de Assis')
            })
        })
    });

    // Objetivo: Validar que é possível obter detalhes de um livro específico pelo ID
    // Verificar que todos os campos do livro são retornados corretamente
    it('GET - Deve obter detalhes de um livro específico', () => {
        // Pega um livro existente do catálogo para garantir um ID válido
        cy.api({
            method: 'GET',
            url: 'books',
            qs: { limit: 1 }
        }).then(response => {
            const livroExistente = response.body.books[0]

            cy.api({
                method: 'GET',
                url: `books/${livroExistente.id}`
            }).should(detalheResponse => {
                expect(detalheResponse.status).to.equal(200)
                expect(detalheResponse.body).to.have.property('book')
                expect(detalheResponse.body.book.id).to.equal(livroExistente.id)
                expect(detalheResponse.body.book).to.have.property('title')
                expect(detalheResponse.body.book).to.have.property('author')
                expect(detalheResponse.body.book).to.have.property('category')

                // Bloco de disponibilidade
                expect(detalheResponse.body).to.have.property('availability')
                expect(detalheResponse.body.availability).to.have.property('total_copies')
                expect(detalheResponse.body.availability).to.have.property('available_copies')

                // Bloco de estatísticas
                expect(detalheResponse.body).to.have.property('statistics')
                expect(detalheResponse.body.statistics).to.have.property('total_reservations')
                expect(detalheResponse.body.statistics).to.have.property('average_rating')
            })
        })
    });

    // Objetivo: Validar que um novo livro é adicionado com sucesso ao catálogo
    // Verificar que apenas admin pode adicionar novos livros (validação de permissão)
    it('POST - Deve cadastrar um novo livro com sucesso', () => {
        const titulo = `Livro de Teste ${Date.now()}`

        // Sem token, a criação deve ser bloqueada (apenas admin pode criar)
        cy.api({
            method: 'POST',
            url: 'books',
            body: { title: titulo, author: 'Autor de Teste', category: 'Geral', total_copies: 3 },
            failOnStatusCode: false
        }).should(response => {
            expect(response.status).to.equal(401)
        })

        // Com token de admin, o cadastro deve ser concluído com sucesso
        cy.api({
            method: 'POST',
            url: 'books',
            headers: { 'Authorization': token },
            body: {
                title: titulo,
                author: 'Autor de Teste',
                category: 'Geral',
                description: 'Livro criado via teste automatizado',
                total_copies: 3,
                available_copies: 3
            }
        }).should(response => {
            expect(response.status).to.equal(201)
            expect(response.body.message).to.equal('Livro criado com sucesso.')
            expect(response.body.book).to.have.property('id')
            expect(response.body.book.title).to.equal(titulo)
            expect(response.body.book.author).to.equal('Autor de Teste')
        })
    });

    // Objetivo: Garantir que dados inválidos são rejeitados ao adicionar um livro
    // Validar mensagens de erro apropriadas para dados faltantes ou incorretos
    it('POST -  Deve rejeitar livro com dados inválidos', () => {
        // Envia o cadastro sem o campo obrigatório "title"
        cy.api({
            method: 'POST',
            url: 'books',
            headers: { 'Authorization': token },
            body: {
                author: 'Autor sem título de livro'
            },
            failOnStatusCode: false
        }).should(response => {
            expect(response.status).to.equal(400)
            expect(response.body).to.have.property('message')
            expect(response.body.message).to.contain('title')
        })
    });

    // Objetivo: Validar que um livro pode ser atualizado com sucesso
    // Verificar que apenas admin pode atualizar livros (validação de permissão)
    it('PUT - Deve atualizar um livro previamente cadastrado', () => {
        // Cadastra um livro para servir de base para a atualização
        cy.cadastrarLivro(token, {
            title: `Livro para Atualizar ${Date.now()}`,
            author: 'Autor Original',
            category: 'Geral',
            total_copies: 2
        }).then(livroId => {

            // Sem token, a atualização deve ser bloqueada (apenas admin pode editar)
            cy.api({
                method: 'PUT',
                url: `books/${livroId}`,
                body: { title: 'Tentativa sem permissão' },
                failOnStatusCode: false
            }).should(response => {
                expect(response.status).to.equal(401)
            })

            // Com token de admin, a atualização deve ser concluída com sucesso
            cy.api({
                method: 'PUT',
                url: `books/${livroId}`,
                headers: { 'Authorization': token },
                body: {
                    title: 'Livro Atualizado via Teste',
                    author: 'Autor Atualizado',
                    category: 'Geral',
                    description: 'Descrição atualizada pelo teste automatizado'
                }
            }).should(response => {
                expect(response.status).to.equal(200)
                expect(response.body.message).to.equal('Livro atualizado com sucesso.')
                expect(response.body.bookId).to.equal(livroId)
            })

            // Confirma que os dados foram realmente atualizados
            cy.api({
                method: 'GET',
                url: `books/${livroId}`
            }).should(response => {
                expect(response.body.book.title).to.equal('Livro Atualizado via Teste')
                expect(response.body.book.author).to.equal('Autor Atualizado')
            })
        })
    });

    // Objetivo: Validar que um livro pode ser removido do catálogo
    // Verificar que apenas admin pode deletar livros (validação de permissão)
    it('DELETE - Deve deletar um livro previamente cadastrado', () => {
        // Cadastra um livro para servir de base para a exclusão
        cy.cadastrarLivro(token, {
            title: `Livro para Deletar ${Date.now()}`,
            author: 'Autor a Remover',
            category: 'Geral',
            total_copies: 1
        }).then(livroId => {

            // Sem token, a exclusão deve ser bloqueada (apenas admin pode deletar)
            cy.api({
                method: 'DELETE',
                url: `books/${livroId}`,
                failOnStatusCode: false
            }).should(response => {
                expect(response.status).to.equal(401)
            })

            // Com token de admin, a exclusão deve ser concluída com sucesso
            cy.api({
                method: 'DELETE',
                url: `books/${livroId}`,
                headers: { 'Authorization': token }
            }).should(response => {
                expect(response.status).to.equal(200)
                expect(response.body.message).to.equal('Livro deletado com sucesso.')
                expect(response.body.deletedBook.id).to.equal(livroId)
            })

            // Confirma que o livro não existe mais no catálogo
            cy.api({
                method: 'GET',
                url: `books/${livroId}`,
                failOnStatusCode: false
            }).should(response => {
                expect(response.status).to.equal(404)
            })
        })
    });
});
