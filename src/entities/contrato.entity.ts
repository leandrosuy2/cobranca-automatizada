import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Cliente } from './cliente.entity';
import { Parcela } from './parcela.entity';

@Entity('contratos', { orderBy: { id: 'ASC' } })
export class Contrato {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  cliente_id: number;

  @ManyToOne(() => Cliente, cliente => cliente.contratos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cliente_id' })
  cliente: Cliente;

  @OneToMany(() => Parcela, parcela => parcela.contrato)
  parcelas: Parcela[];
} 